import {
  Component,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectorRef,
  OnInit,
  EventEmitter,
  Output,
  ChangeDetectionStrategy
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
import { AppState, forceSave, resetStepper, selectAutoSaveStatusText, selectIsEditMode, selectOrderId, selectStepAutoSaveStatus, selectStepHasPendingChanges, selectStepperSummary, setGlobalError, setStepCompleted, setStepLoading, setStepValidation, triggerAutoSave, updateStep3OptimizationResult } from '../../../../../store';
import { selectTruck } from '../../../../../store';

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
    MatStepperPrevious,
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

  piecesData: any[] = [];
  originalPiecesData: any[] = []; // NEW: Track original data
  truckDimension = this.store.selectSignal(selectTruck)
  orderResultId: string = '';


  isLoading: boolean = false;
  hasResults: boolean = false;
  showVisualization: boolean = false;
  optimizationProgress: number = 0;
  hasThreeJSError: boolean = false;

  hasUnsavedChanges: boolean = false;
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

    this.setupAutoSaveListeners();
    this.performanceMetrics.startTime = performance.now();
  }

  private setupAutoSaveListeners(): void {
    this.watchResultChanges();
  }

  private watchResultChanges(): void {
    setInterval(() => {
      if (this.isLoading || this.processingLock || this.isDestroyed) {
        return;
      }
      const currentState = this.getCurrentResultState();
      if (currentState !== this.lastResultState && this.hasResults) {
        this.lastResultState = currentState;
      }
    }, 3000);
  }

  private getCurrentResultState(): string {
    try {
      return JSON.stringify({
        hasResults: this.hasResults,
        showVisualization: this.showVisualization,
        piecesDataLength: this.piecesData?.length || 0,
        reportFilesLength: this.reportFiles?.length || 0,
        currentViewType: this.currentViewType,
        hasThreeJSError: this.hasThreeJSError,
        hasUnsavedChanges: this.hasUnsavedChanges,
        timestamp: Date.now()
      });
    } catch (error) {
      return '';
    }
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
    this.safeResetState();
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

  onDataChanged(updatedData: any[]): void {
    if (this.isDestroyed || !updatedData || !Array.isArray(updatedData)) {
      return;
    }

    this.piecesData = updatedData;
    this.store.dispatch(updateStep3OptimizationResult({
      optimizationResult: updatedData
    }));

    this.hasUnsavedChanges = true;
    this.lastDataChangeTime = new Date();

    this.performanceMetrics.dataChangeCount++;

    this.safeUpdateUI();
    this.cdr.markForCheck();
  }


  resetToOriginalData(): void {
    if (!this.originalPiecesData || this.originalPiecesData.length === 0) {
      this.toastService.warning('Sıfırlamak için orijinal veri bulunamadı');
      return;
    }

    const confirmed = confirm(
      '🔄 Tüm değişiklikleri geri al ve orijinal veriye dön?\n\n' +
      `Mevcut: ${this.piecesData.length} paket\n` +
      `Orijinal: ${this.originalPiecesData.length} paket\n` +
      '⚠️ Bu işlem geri alınamaz!'
    );

    if (!confirmed) return;
    try {
      this.piecesData = JSON.parse(JSON.stringify(this.originalPiecesData));
      this.hasUnsavedChanges = false;

      this.safeProcessOptimizationResult({
        data: this.piecesData
      });

      this.safeUpdateUI();

      this.toastService.success('Veriler orijinal haline sıfırlandı');
      this.cdr.markForCheck();

    } catch (error) {

      this.toastService.error('Veri sıfırlama hatası');
    }
  }

  forceSaveStep3(): void {
    if (this.hasResults) {
      const SaveData = {
        optimizationResult: this.piecesData || [],
        reportFiles: this.reportFiles || [],
        hasResults: this.hasResults,
        showVisualization: this.showVisualization,
        timestamp: new Date().toISOString()
      };

      this.store.dispatch(forceSave({
        stepNumber: 2,
        data: SaveData
      }));
    }
  }

  private safeResetState(): void {
    if (this.isDestroyed) return;
    this.isLoading = true;
    this.hasResults = false;
    this.showVisualization = false;
    this.hasThreeJSError = false;
    this.optimizationProgress = 0;
    this.piecesData = [];
    this.originalPiecesData = []; // NEW
    this.processedPackages = [];
    this.reportFiles = [];

    this.hasUnsavedChanges = false;
    this.lastDataChangeTime = new Date();
    this.totalPackagesProcessed = 0;
    this.safeUpdateUI();
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
  async onFileClick(event: Event, file: any): Promise<void> {
    event.preventDefault(); // Link'in default davranışını engelle

    if (!file?.file) {
      this.toastService.warning('Dosya bulunamadı');
      return;
    }

    // Eğer değişiklik varsa, önce kaydet
    if (this.hasUnsavedChanges) {
      this.toastService.info('Değişiklikler kaydediliyor...');

      try {
        // saveResults'ı bekle
        await this.saveResultsAndWait();

        // Kayıt başarılı, dosyayı aç
        this.openFile(file);

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

  /**
   * SaveResults metodunu Promise'e çevir (beklenebilir hale getir)
   */
  private saveResultsAndWait(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.hasResults || this.isDestroyed) {
        reject(new Error('No results to save'));
        return;
      }

      this.repositoryService.partialUpdateOrderResult(this.piecesData, this.orderResultId)
        .pipe(
          switchMap(() => this.repositoryService.createReport()),
          tap((response) => {
            if (response?.file) {
              this.reportFiles = response.file
            }
          }),
          finalize(() => {
            this.hasUnsavedChanges = false;
            this.cdr.detectChanges();
          }),
          catchError(error => {
            this.toastService.error('İşlem sırasında hata: ' + error.message);
            reject(error);
            return EMPTY;
          })
        )
        .subscribe({
          next: () => {
            this.toastService.success('Değişiklikler kaydedildi');
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  saveResults(): void {
    if (!this.hasResults || this.isDestroyed) {
      this.toastService.warning('Kaydetmek için önce optimizasyonu çalıştırın.');
      return;
    }

    this.repositoryService.partialUpdateOrderResult(this.piecesData, this.orderResultId)
      .pipe(
        switchMap(() => this.repositoryService.createTruckPlacementReport()),
        tap((response) => {
          if (response?.file) {
            // Eski tır yerleşim raporunu çıkar
            this.reportFiles = this.reportFiles.filter(f =>
              !f.name.startsWith('Tır_Yerleşimi')
            );
            this.reportFiles.push(response.file);
          }
        }),
        finalize(() => {
          this.hasUnsavedChanges = false;
          this.cdr.detectChanges();
        }),
        catchError(error => {
          this.toastService.error('İşlem sırasında hata: ' + error.message);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastService.success('Sonuçlar başarıyla kaydedildi.');
      });
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

  completeShipment(): void {
    // tira yerlesmeyen packagelar otomatik olarak siparisten kaldirilacaktir.
    // onayliyor musunuz.
    // yine de devam et
    // result guncelle
    // order detail guncelle
    // package guncelle


    if (!this.hasResults) {
      this.toastService.warning('Önce optimizasyonu tamamlayın');
      return;
    }

    const confirmMessage = 'Sevkiyat tamamlanacak, onaylıyor musunuz?'

    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    try {
      this.localStorageService.clearStorage();
      this.store.dispatch(resetStepper());

      this.toastService.success(
        `Sevkiyat başarıyla tamamlandı!`,
        'Tamamlandı!'
      );

      setTimeout(() => {
        this.shipmentCompleted.emit();
      }, 1500);

    } catch (error) {
      this.toastService.error('Sevkiyat tamamlanırken hata oluştu');
    }
  }
}
