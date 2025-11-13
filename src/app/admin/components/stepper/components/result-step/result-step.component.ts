import {
  Component,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectorRef,
  OnInit,
  EventEmitter,
  Output,
  ChangeDetectionStrategy,
  signal,
  effect
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatStepperPrevious } from '@angular/material/stepper';
import { RepositoryService } from '../../services/repository.service';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../../../services/toast.service';
import { switchMap, takeUntil, catchError, finalize, tap } from 'rxjs/operators';
import { Subject, EMPTY, of } from 'rxjs';
import { LocalStorageService } from '../../services/local-storage.service';
import { ThreeJSTruckVisualizationComponent } from '../../../../../components/threejs-truck-visualization/threejs-truck-visualization.component';
import { OrderResultService } from '../../../services/order-result.service';

import { Store } from '@ngrx/store';
import { AppState, cleanUpInvalidPackagesFromOrder, navigateToStep, selectAutoSaveStatusText, selectIsEditMode, selectOrderId, selectRemainingProducts, selectStep3IsDirty, selectStepAutoSaveStatus, selectStepHasPendingChanges, selectStepperSummary, setGlobalError, setStepCompleted, setStepLoading, setStepperData, setStepValidation, updateOrderResult } from '../../../../../store';
import { selectTruck } from '../../../../../store';
import { CancelConfirmationDialogComponent } from '../../../../../components/cancel-confirmation-dialog/cancel-confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';

interface PackageData {
  id: number;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  color?: string;
  dimensions?: string;
}

@Component({
  selector: 'app-result-step',
  standalone: true,
  imports: [
    CommonModule,
    MatButton,
    MatIconModule,
    ThreeJSTruckVisualizationComponent
  ],
  templateUrl: './result-step.component.html',
  styleUrl: './result-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultStepComponent implements OnInit, OnDestroy {
  @ViewChild('threeJSComponent') threeJSComponent!: ThreeJSTruckVisualizationComponent;
  @Output() shipmentCompleted = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private isDestroyed = false;
  public processingLock = false;
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);
  piecesData: any[] = [];
  originalPiecesData: any[] = []; // NEW: Track original data
  truckDimension = this.store.selectSignal(selectTruck)
  orderResultId: string = '';


  remainingProducts = this.store.selectSignal(selectRemainingProducts);
  public isDirtySignal = this.store.selectSignal(selectStep3IsDirty);
  isLoading: boolean = false;
  hasResults: boolean = false;
  showVisualization: boolean = false;
  optimizationProgress: number = 0;
  hasThreeJSError: boolean = false;

  lastDataChangeTime: Date = new Date();
  totalPackagesProcessed: number = 0;

  reportFiles: any[] = [];
  processedPackages: PackageData[] = [];


  private popupWindow: Window | null = null;
  private progressInterval: any = null;

  private readonly localStorageService = inject(LocalStorageService);
  repositoryService = inject(RepositoryService);
  sanitizer = inject(DomSanitizer);
  toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  orderResultService = inject(OrderResultService)
  private pendingFile = signal<any>(null);

  // Effect ile isDirty değişimini dinle
  private fileOpenEffect = effect(() => {
    const isDirty = this.isDirtySignal();
    const pending = this.pendingFile();

    // isDirty false oldu VE bekleyen dosya var
    if (!isDirty && pending) {
      this.openFile(pending);
      this.pendingFile.set(null); // Temizle
    }
  });
  // NgRx Observables
  public isEditMode$ = this.store.select(selectIsEditMode);
  public editOrderId$ = this.store.select(selectOrderId);
  public stepperSummary$ = this.store.select(selectStepperSummary);
  public autoSaveStatus$ = this.store.select(selectStepAutoSaveStatus(2));
  public autoSaveStatusText$ = this.store.select(selectAutoSaveStatusText(2));
  public hasPendingChanges$ = this.store.select(selectStepHasPendingChanges(2));

  private lastResultState: string = '';
  private resultAutoSaveTimeout: any;
  public currentViewType: string = 'isometric';

  public performanceMetrics = {
    startTime: 0,
    endTime: 0,
    memoryUsage: 0,
    renderTime: 0,
    dataChangeCount: 0,
    averageResponseTime: 0
  };

  ngOnInit(): void {

    this.performanceMetrics.startTime = performance.now();
  }


  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.processingLock = false;
    this.performCleanup();
  }

  private performCleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.resultAutoSaveTimeout) {
      clearTimeout(this.resultAutoSaveTimeout);
      this.resultAutoSaveTimeout = null;
    }

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (this.popupWindow && !this.popupWindow.closed) {
      try {
        this.popupWindow.close();
      } catch (error) {
      }
      this.popupWindow = null;
    }
    this.performanceMetrics.endTime = performance.now();
  }

  calculateBinpacking(): void {
    if (this.processingLock || this.isDestroyed) {
      return;
    }
    this.processingLock = true;
    this.store.dispatch(setStepLoading({
      stepIndex: 2,
      loading: true,
      operation: 'Calculating bin packing optimization'
    }));
    this.startProgressSimulation();

    this.repositoryService
      .calculatePacking()
      .pipe(
        takeUntil(this.destroy$),
        switchMap((response) => {
          if (this.isDestroyed) {
            throw new Error('Component destroyed during processing');
          }
          this.orderResultId = response.data.order_result_id
          this.store.dispatch(setStepperData({ data: { orderResultId: this.orderResultId } }));
          this.safeProcessOptimizationResult(response);
          this.originalPiecesData = JSON.parse(JSON.stringify(this.piecesData));
          this.optimizationProgress = Math.min(80, this.optimizationProgress);
          this.safeUpdateUI();
          return this.repositoryService.createReport();
        }),
        catchError((error) => {
          this.handleError(error);
          return EMPTY;
        }),
        finalize(() => {
          this.processingLock = false;
          this.stopProgressSimulation();
          this.store.dispatch(setStepLoading({
            stepIndex: 2,
            loading: false
          }));
        })
      )
      .subscribe({
        next: (reportResponse) => {
          if (this.isDestroyed) return;
          this.reportFiles = Array.isArray(reportResponse?.files)
            ? reportResponse.files
            : [];
          this.optimizationProgress = 100;
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.safeFinalize();
            }
          }, 500);
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (!this.isDestroyed) {
            // Global error dispatch et
            this.store.dispatch(setGlobalError({
              error: {
                message: 'Optimizasyon hesaplaması sırasında hata oluştu: ' + (error.message || error),
                code: error.status?.toString(),
                stepIndex: 2
              }
            }));

            this.handleError(error);
            this.cdr.markForCheck();
          }
        },
      });
  }

  private safeProcessOptimizationResult(response: any): void {
    if (this.isDestroyed) return;

    try {
      let packingData = null;

      if (response?.data) {
        if (typeof response.data === 'string') {
          try {
            packingData = JSON.parse(response.data);
          } catch (parseError) {

            packingData = null;
          }
        } else if (response.data.data) {
          packingData = response.data.data;

        } else {
          packingData = response.data;
        }
      }

      if (packingData && Array.isArray(packingData) && packingData.length > 0) {
        this.piecesData = this.validateAndCleanPackingData(packingData);
        this.safeProcessPackageData();
        this.totalPackagesProcessed = this.piecesData.length;
      } else {
        this.piecesData = [];
        this.processedPackages = [];
        this.totalPackagesProcessed = 0;
      }
    } catch (error) {
      this.piecesData = [];
      this.processedPackages = [];
      this.totalPackagesProcessed = 0;
    }
  }

  private validateAndCleanPackingData(rawData: any[]): any[] {
    return rawData.filter((piece, index) => {
      if (!Array.isArray(piece) || piece.length < 6) {
        return false;
      }
      const [x, y, z, length, width, height] = piece;
      if ([x, y, z, length, width, height].some(val => typeof val !== 'number' || isNaN(val))) {

        return false;
      }
      return true;
    });
  }

  private safeProcessPackageData(): void {
    if (this.isDestroyed || !Array.isArray(this.piecesData)) return;

    try {
      this.processedPackages = this.piecesData.map(
        (piece: any, index: number) => ({
          id: piece[6] || index,
          x: piece[0] || 0,
          y: piece[1] || 0,
          z: piece[2] || 0,
          length: piece[3] || 0,
          width: piece[4] || 0,
          height: piece[5] || 0,
          weight: piece[7] || 0,
          color: '',
          dimensions: `${piece[3] || 0}×${piece[4] || 0}×${piece[5] || 0}mm`,
        })
      );
    } catch (error) {
      this.processedPackages = [];
    }
  }

  private safeFinalize(): void {
    if (this.isDestroyed) return;

    this.isLoading = false;
    this.hasResults = true;
    this.showVisualization = true;
    this.hasThreeJSError = false;

    this.store.dispatch(setStepCompleted({ stepIndex: 2 }));
    this.store.dispatch(setStepValidation({ stepIndex: 2, isValid: true }));

    this.safeUpdateUI();
    this.toastService.success(' paketleme ve rapor başarıyla oluşturuldu.');
    this.performanceMetrics.endTime = performance.now();

  }

  private handleError(error: any): void {
    if (this.isDestroyed) return;

    this.isLoading = false;
    this.hasResults = false;
    this.optimizationProgress = 0;

    this.safeUpdateUI();

    const errorMessage = this.getErrorMessage(error);
    this.toastService.error(errorMessage);


  }

  private safeUpdateUI(): void {
    if (this.isDestroyed) return;

    try {
      this.cdr.detectChanges();
    } catch (error) {

    }
  }

  private startProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (this.isDestroyed || !this.isLoading) {
        this.stopProgressSimulation();
        return;
      }

      if (this.optimizationProgress < 70) {
        const increment = Math.random() * 8 + 2;
        this.optimizationProgress = Math.min(70, this.optimizationProgress + increment);
        this.safeUpdateUI();
      }
    }, 500);
  }

  private stopProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }


  onThreeJSError(error: any): void {
    this.hasThreeJSError = true;
    this.showVisualization = false;
    this.toastService.error('3D görselleştirmede hata oluştu');
    this.cdr.detectChanges();
  }

  getFileIcon(fileType: string | null): string {
    if (!fileType) return 'insert_drive_file';

    const type = fileType.toLowerCase();

    if (type.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (
      type.includes('image') ||
      type.includes('jpg') ||
      type.includes('jpeg') ||
      type.includes('png')
    ) {
      return 'image';
    } else if (
      type.includes('excel') ||
      type.includes('sheet') ||
      type.includes('xlsx') ||
      type.includes('xls')
    ) {
      return 'table_chart';
    } else if (type.includes('word') || type.includes('doc')) {
      return 'description';
    } else if (
      type.includes('zip') ||
      type.includes('rar') ||
      type.includes('archive')
    ) {
      return 'folder_zip';
    } else if (type.includes('text') || type.includes('txt')) {
      return 'article';
    } else if (type.includes('video')) {
      return 'videocam';
    } else if (type.includes('audio')) {
      return 'audiotrack';
    }

    return 'insert_drive_file';
  }


  private getErrorMessage(error: any): string {
    if (error?.status === 0) {
      return 'Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.';
    } else if (error?.status >= 400 && error?.status < 500) {
      return 'İstek hatası. Lütfen parametreleri kontrol edin.';
    } else if (error?.status >= 500) {
      return 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
    } else {
      return error?.message || 'Beklenmeyen bir hata oluştu.';
    }
  }

  /**
   * File tıklaması - Unsaved changes varsa önce kaydet
   */
  onFileClick(event: Event, file: any):void {
    event.preventDefault(); // Link'in default davranışını engelle

    if (!file?.file) {
      this.toastService.warning('Dosya bulunamadı');
      return;
    }

    // Eğer değişiklik varsa, önce kaydet
    if (this.isDirtySignal()) {
      try {
        this.pendingFile.set(file);
        this.completeOrder();

      } catch (error) {
        this.toastService.error('Kayıt sırasında hata oluştu');
      }
    } else {
      // Değişiklik yok, direkt aç
      this.openFile(file);
    }
  }

  /**
   * Dosyayı yeni sekmede aç
   */
  private openFile(file: any): void {
    if (!file?.file) return;

    try {
      // Yeni sekmede aç
      window.open(file.file, '_blank');
      this.toastService.success('Dosya açılıyor...');
    } catch (error) {
      this.toastService.error('Dosya açılırken hata oluştu');
    }
  }

  trackByFileId(index: number, file: any): any {
    return file?.id || file?.name || index;
  }

  formatFileSize(bytes: number): string {
    if (!bytes || isNaN(bytes)) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  goPreviousStep() {
    this.store.dispatch(navigateToStep({ stepIndex: 1 }));
  }

  completeShipment(): void {
    // eger step 3 isDirty ise veya deletedPackages varsa  kaydet yazmali
    // eger step 3 isDirty degilse siparisi kapat yazmali
    if (!this.hasResults) {
      this.toastService.warning('Önce optimizasyonu tamamlayın');
      return;
    }
    this.completeOrder();
    this.shipmentCompleted.emit();

  }

  completeOrder(){
    const orderResult = this.convertPiecesToJsonString();

    if (this.threeJSComponent.deletedPackages.length > 0) {
      const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
        width: '400px',
        maxWidth: '95vw',
        disableClose: true,
        panelClass: 'cancel-confirmation-dialog',
        data: {
          header: "Yerleştirilmeyen paketler var!",
          title: "Bütün paketler yerleştirilmemiş veya sığmıyor olabilir.",
          info: "Eğer bu şekide devam etmek isterseniz yerleştirilmeyen ürünler siparişten kaldırılacaktır.",
          confirmButtonText: "Yine de devam et."
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result === true) {
          this.store.dispatch(cleanUpInvalidPackagesFromOrder({ packageNames: this.threeJSComponent.deletedPackages.map(pckg => pckg.id) }));
          this.threeJSComponent.deletedPackages = []
          this.store.dispatch(updateOrderResult({orderResult}))
        }
        else {
          return;
        }
      });
    } else {
      this.store.dispatch(updateOrderResult({orderResult}))
    }
  }

  convertPiecesToJsonString(): string {
    const piecesData = this.threeJSComponent.processedPackages;

    const formattedData = piecesData.map(piece => [
      piece.x,
      piece.y,
      piece.z,
      piece.length,
      piece.width,
      piece.height,
      piece.id,
      piece.weight
    ]);

    return JSON.stringify(formattedData);
  }

}
