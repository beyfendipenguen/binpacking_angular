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
  effect,
  untracked,
  computed
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, finalize, take, withLatestFrom } from 'rxjs/operators';

import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '@core/services/toast.service';
import { CancelConfirmationDialogComponent } from '@shared/cancel-confirmation-dialog/cancel-confirmation-dialog.component';
import { ThreeJSTruckVisualizationComponent } from '@shared/threejs-truck-visualization/threejs-truck-visualization.component';

import { AppState, selectRemainingProducts, selectStep3IsDirty, selectOrderId, selectIsEditMode, selectHasRevisedOrder, selectOrderResult, selectOrderResultId, selectStep3CurrentViewType, selectStep3ReportFiles } from '@app/store';
import { StepperUiActions } from '@app/store/stepper/actions/stepper-ui.actions';
import { StepperResultActions } from '@app/store/stepper/actions/stepper-result.actions';
import { ReportFile, ResultStepService } from './result-step.service';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

@Component({
  selector: 'app-result-step',
  standalone: true,
  imports: [CommonModule,
    MatButton,
    MatIconModule,
    ThreeJSTruckVisualizationComponent,
    TranslateModule
  ],
  templateUrl: './result-step.component.html',
  styleUrl: './result-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultStepComponent implements OnInit, OnDestroy {

  private translate = inject(TranslateService);
  @ViewChild('threeJSComponent') threeJSComponent!: ThreeJSTruckVisualizationComponent;
  @Output() shipmentCompleted = new EventEmitter<void>();

  // Services
  private readonly destroy$ = new Subject<void>();
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toastService = inject(ToastService);
  private readonly resultStepService = inject(ResultStepService);

  // Signals

  public orderIdSignal = this.store.selectSignal(selectOrderId);
  readonly isLoadingSignal = signal(false);
  readonly hasResultsSignal = computed(() =>
    this.orderResultSignal()?.length > 0
  );
  readonly isDirtySignal = this.store.selectSignal(selectStep3IsDirty);
  readonly remainingProducts = this.store.selectSignal(selectRemainingProducts);

  readonly orderResultSignal = this.store.selectSignal(selectOrderResult);
  readonly reportFilesSignal = this.store.selectSignal(selectStep3ReportFiles);
  readonly orderResultIdSignal = this.store.selectSignal(selectOrderResultId);
  readonly currentViewTypeSignal = this.store.selectSignal(selectStep3CurrentViewType);


  // Computed
  readonly canCompleteShipment = computed(() =>
    this.hasResultsSignal() && !this.isLoadingSignal()
  );

  // Data
  piecesData: PackagePosition[] = [];
  originalPiecesData: any[] = [];

  // UI State
  isLoading = false;
  hasThreeJSError = false;
  optimizationProgress = 0;

  // File download
  private pendingFileName = signal<string | null>(null);

  /**
   * Effect: Auto-open file after save
   */
  private fileOpenEffect = effect(() => {
    const isDirty = this.isDirtySignal();
    // Store'daki güncel dosya listesini al
    const currentReportFiles = this.reportFilesSignal();

    if (!isDirty) {
      untracked(() => {
        // Hangi tip dosyayı bekliyorduk?
        const pendingName = this.pendingFileName();

        if (pendingName && currentReportFiles?.length > 0) {
          // YENİ LİSTEDEN GÜNCEL DOSYAYI BUL
          const newFileObj = currentReportFiles.find(f => (f.type) === pendingName);

          if (newFileObj) {
            // Güncel nesne ile aç
            this.resultStepService.openFile(newFileObj);
          } else {
            // Nadir durum: Dosya yeni listede yoksa uyarı verilebilir
            console.warn('Beklenen dosya yeni listede bulunamadı');
          }

          // Beklemeyi temizle
          this.pendingFileName.set(null);
        }
      });
    }
  });

  constructor() { }


  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================
  // BINPACKING CALCULATION
  // ========================================
  calculateBinpacking(): void {

    this.isLoading = true;
    this.isLoadingSignal.set(true);
    this.optimizationProgress = 0;

    this.startProgressSimulation();

    this.store.select(selectIsEditMode).pipe(
      take(1),
      withLatestFrom(this.store.select(selectHasRevisedOrder))
    ).subscribe(([isEditMode, hasRevised]) => {
      if (isEditMode && !hasRevised) {
        this.store.select(selectOrderId).pipe(take(1)).subscribe(orderId => {
          this.store.dispatch(StepperUiActions.reviseOrder({ orderId }));
        });
      }
    });

    this.resultStepService
      .calculateAndGenerateReport()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.stopProgressSimulation();
          this.isLoading = false;
          this.isLoadingSignal.set(false);
          this.optimizationProgress = 100;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {

          this.store.dispatch(StepperResultActions.setOrderResultId({
            orderResultId: result.orderResultId
          }));

          this.store.dispatch(StepperResultActions.loadOrderResultSuccess({
            orderResult: result.orderResult,
            reportFiles: result.reportFiles
          }));

          this.piecesData = result.orderResult;


          this.toastService.success(this.translate.instant('RESULT_STEP.PACKAGING_SUCCESS'));

          if (this.piecesData.find(pkg => pkg[0] === -1 && pkg[1] === -1 && pkg[2] === -1)) {
            this.store.dispatch(StepperResultActions.setIsDirty({ isDirty: true }));
          }

          this.cdr.markForCheck();
        },
        error: (error) => {
          this.store.dispatch(StepperUiActions.setGlobalError({
            error: {
              message: this.translate.instant('RESULT_STEP.OPTIMIZATION_ERROR') + (error.message || error),
              code: error.status?.toString(),
              stepIndex: 2
            }
          }));

          this.toastService.error(this.getErrorMessage(error));
        }
      });
  }

  // ========================================
  // PROGRESS SIMULATION
  // ========================================

  private progressInterval: any = null;

  private startProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (this.optimizationProgress < 70) {
        const increment = Math.random() * 8 + 2;
        this.optimizationProgress = Math.min(70, this.optimizationProgress + increment);
        this.cdr.markForCheck();
      }
    }, 500);
  }

  private stopProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  // ========================================
  // FILE HANDLING
  // ========================================

  onFileClick(event: Event, file: any): void {
    event.preventDefault();

    if (!file?.file) {
      this.toastService.warning(this.translate.instant('RESULT_STEP.FILE_NOT_FOUND'));
      return;
    }

    if (this.isDirtySignal()) {
      try {
        // DEĞİŞİKLİK BURADA:
        // Dosyanın tamamını değil, onu yeni listede bulmamızı sağlayacak ID'sini kaydediyoruz.
        // Not: file.type, file.name veya file.id hangisi unique ise onu kullanın.
        this.pendingFileName.set(file.type);

        this.completeOrder(false);
      } catch (error) {
        this.toastService.error(this.translate.instant('RESULT_STEP.SAVE_ERROR'));
      }
    } else {
      this.resultStepService.openFile(file);
    }
  }

  trackByFileId(index: number, file: ReportFile): any {
    return file?.id || file?.name || index;
  }

  formatFileSize(bytes: number): string {
    return this.resultStepService.formatFileSize(bytes);
  }

  getFileIcon(fileType: string | null): string {
    return this.resultStepService.getFileIcon(fileType);
  }

  // ========================================
  // NAVIGATION
  // ========================================

  goPreviousStep(): void {
    this.store.dispatch(StepperUiActions.navigateToStep({ stepIndex: 1 }));
  }

  completeShipment(): void {
    if (!this.hasResultsSignal()) {
      this.toastService.warning(this.translate.instant('RESULT_STEP.COMPLETE_OPTIMIZATION_FIRST'));
      return;
    }

    this.completeOrder(true);
  }

  // ========================================
  // ORDER COMPLETION
  // ========================================

  async completeOrder(resetStepper: boolean): Promise<void> {
    try {
      const deletedPackages = this.threeJSComponent?.deletedPackagesSignal() || [];

      if (deletedPackages.length > 0) {
        await this.warningDialog();
      } else {
        const processedPackages = this.threeJSComponent?.processedPackagesSignal() || [];
        const orderResult = await this.resultStepService.formatPackagesForResult(processedPackages);
        this.submitOrderResult(orderResult, resetStepper);
      }
    } catch (error) {
      this.toastService.error(this.translate.instant('RESULT_STEP.ORDER_COMPLETE_ERROR'));
    }
  }

  /**
   * Handle deleted packages confirmation
   */
  private async warningDialog(): Promise<void> {
    this.dialog.open(CancelConfirmationDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      disableClose: true,
      panelClass: 'cancel-confirmation-dialog',
      data: {
        header: this.translate.instant('RESULT_STEP.UNPLACED_PACKAGES'),
        title: this.translate.instant('RESULT_STEP.UNPLACED_PACKAGES_MESSAGE'),
        info: this.translate.instant('RESULT_STEP.CHECK_PACKAGES_MESSAGE'),
        rejectButtonText: this.translate.instant('COMMON.OK'),
        showYesButton: false
      }
    });
  }

  /**
   * Submit order result to store
   */
  private submitOrderResult(orderResult: PackagePosition[], resetStepper: boolean): void {
    this.store.dispatch(StepperResultActions.resultStepSubmit({
      orderId: this.orderIdSignal(),
      orderResult,
      resetStepper
    }));

    if (resetStepper) {
      this.piecesData = [];
      this.originalPiecesData = [];
    }

    this.shipmentCompleted.emit();
    this.toastService.success(this.translate.instant('RESULT_STEP.ORDER_COMPLETED'));
  }

  // ========================================
  // THREE.JS ERROR HANDLING
  // ========================================

  onThreeJSError(error: any): void {
    this.hasThreeJSError = true;
    this.toastService.error(this.translate.instant('RESULT_STEP.VISUALIZATION_3D_ERROR'));
    this.cdr.detectChanges();
  }

  // ========================================
  // UTILITIES
  // ========================================

  private getErrorMessage(error: any): string {
    if (error?.status === 0) {
      return this.translate.instant('RESULT_STEP.CONNECTION_ERROR');
    } else if (error?.status >= 400 && error?.status < 500) {
      return this.translate.instant('RESULT_STEP.REQUEST_ERROR');
    } else if (error?.status >= 500) {
      return this.translate.instant('RESULT_STEP.SERVER_ERROR');
    } else {
      return error?.message || this.translate.instant('RESULT_STEP.UNEXPECTED_ERROR');
    }
  }

  /**
   * Component'i başlangıç haline getirir
   * - Tüm state'leri temizler
   * - Progress simulation'ı durdurur
   * - Three.js component'i reset eder
   */
  resetComponent(): void {
    this.stopProgressSimulation();

    this.isLoadingSignal.set(false);
    this.pendingFileName.set(null);

    this.piecesData = [];
    this.originalPiecesData = [];

    this.isLoading = false;
    this.hasThreeJSError = false;
    this.optimizationProgress = 0;

    if (this.threeJSComponent) {
      this.threeJSComponent.reset();
    }

    this.store.dispatch(StepperResultActions.resetStep3State());

    this.cdr.markForCheck();
  }
}

