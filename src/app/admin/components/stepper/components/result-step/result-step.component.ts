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
import { LoadingComponent } from '../../../../../components/loading/loading.component';
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

interface LoadingStats {
  totalPackages: number;
  packagesLoaded: number;
  utilizationRate: number;
  cogScore: number;
  totalWeight: number;
  efficiency: number;
  deletedCount?: number;
  movedCount?: number;
  rotatedCount?: number;
}

interface AlgorithmStats {
  executionTime: number;
  generations: number;
  bestFitness: number;
  iterationsCount?: number;
  convergenceRate?: number;
}

interface DataChangeEvent {
  timestamp: Date;
  type: 'drag' | 'rotate' | 'delete' | 'restore' | 'initial'| 'unknown';
  packageId?: number;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

@Component({
  selector: 'app-result-step',
  standalone: true,
  imports: [
    CommonModule,
    LoadingComponent,
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
  loadingStats: LoadingStats = {
    totalPackages: 0,
    packagesLoaded: 0,
    utilizationRate: 0,
    cogScore: 0,
    totalWeight: 0,
    efficiency: 0,
    deletedCount: 0,
    movedCount: 0,
    rotatedCount: 0
  };

  isLoading: boolean = false;
  hasResults: boolean = false;
  showVisualization: boolean = false;
  optimizationProgress: number = 0;
  hasThreeJSError: boolean = false;

  hasUnsavedChanges: boolean = false;
  dataChangeHistory: DataChangeEvent[] = [];
  lastDataChangeTime: Date = new Date();
  totalPackagesProcessed: number = 0;

  reportFiles: any[] = [];
  processedPackages: PackageData[] = [];
  algorithmStats: AlgorithmStats = {
    executionTime: 0,
    generations: 0,
    bestFitness: 0,
    iterationsCount: 0,
    convergenceRate: 0
  };

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
    window.addEventListener('beforeunload', this.handleEmergencyAutoSave.bind(this));
  }

  private watchResultChanges(): void {
    setInterval(() => {
      if (this.isLoading || this.processingLock || this.isDestroyed) {
        return;
      }
      const currentState = this.getCurrentResultState();
      if (currentState !== this.lastResultState && this.hasResults) {
        this.triggerAutoSave('user-action');
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
        loadingStats: this.loadingStats,
        algorithmStats: this.algorithmStats,
        currentViewType: this.currentViewType,
        hasThreeJSError: this.hasThreeJSError,
        hasUnsavedChanges: this.hasUnsavedChanges,
        dataChangeHistoryLength: this.dataChangeHistory.length,
        timestamp: Date.now()
      });
    } catch (error) {
      return '';
    }
  }

  private triggerAutoSave(
    changeType: 'user-action' | 'api-response' | 'emergency' | 'data-change' = 'user-action'
  ): void {
    if (this.resultAutoSaveTimeout) {
      clearTimeout(this.resultAutoSaveTimeout);
    }
    if (
      this.hasResults &&
      (this.piecesData?.length > 0 || this.reportFiles?.length > 0)
    ) {
      const SaveData = {
        optimizationResult: this.piecesData || [],
        reportFiles: this.reportFiles || [],
        hasResults: this.hasResults,
        showVisualization: this.showVisualization,
        timestamp: new Date().toISOString(),
        changeType: changeType
      };

      this.store.dispatch(triggerAutoSave({
        stepNumber: 2,
        data: SaveData,
        changeType: changeType
      }));


    }
  }

  private handleEmergencyAutoSave(): void {
    if (this.hasResults && this.hasUnsavedChanges) {
      this.triggerAutoSave('emergency');
    }
  }

  // private checkPrerequisites(): boolean {
  //   const step1Completed = this.localStorageService.isStepCompleted(1);
  //   const step2Completed = this.localStorageService.isStepCompleted(2);

  //   if (!step1Completed || !step2Completed) {
  //     let message = 'Önceki adımları tamamlayın: ';
  //     if (!step1Completed) message += 'Step 1 ';
  //     if (!step2Completed) message += 'Step 2 ';
  //     this.toastService.warning(message);
  //     return false;
  //   }
  //   return true;
  // }
  private saveResultsToSession(): void {
    try {
      const SaveData = {
        optimizationResult: this.piecesData,
        originalOptimizationResult: this.originalPiecesData, // NEW
        reportFiles: this.reportFiles,
        loadingStats: this.loadingStats,
        algorithmStats: this.algorithmStats,
        truckDimension: this.truckDimension,
        hasResults: this.hasResults,
        showVisualization: this.showVisualization,
        currentViewType: this.currentViewType,
        hasThreeJSError: this.hasThreeJSError,
        hasUnsavedChanges: this.hasUnsavedChanges,
        dataChangeHistory: this.dataChangeHistory,
        totalPackagesProcessed: this.totalPackagesProcessed,
        performanceMetrics: this.performanceMetrics,
        timestamp: new Date().toISOString(),
        version: '3.0'
      };

      this.hasUnsavedChanges = false;
      this.store.dispatch(setStepCompleted({ stepIndex: 2 }));
    } catch (error) {
      this.toastService.error('Sonuçlar kaydedilemedi');
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
    window.removeEventListener('beforeunload', this.handleEmergencyAutoSave.bind(this));
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
          this.triggerAutoSave('api-response');
          this.trackDataChange('initial', undefined, {
            packageCount: this.piecesData.length,
            timestamp: new Date().toISOString()
          });
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
              this.triggerAutoSave('api-response');
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
    if (this.isDestroyed || !updatedData) {
      return;
    }

    try {
      const validatedData = this.validateUpdatedData(updatedData);
      if (!validatedData || validatedData.length === 0) {
        return;
      }

      const changeEvent = this.analyzeDataChanges(this.piecesData, validatedData);
      this.piecesData = validatedData;
      this.store.dispatch(updateStep3OptimizationResult({
        optimizationResult: validatedData
      }));

      this.hasUnsavedChanges = true;
      this.lastDataChangeTime = new Date();

      this.performanceMetrics.dataChangeCount++;
      this.performanceMetrics.averageResponseTime =
        (this.performanceMetrics.averageResponseTime + (Date.now() - this.performanceMetrics.startTime)) / 2;

      this.safeProcessOptimizationResult({
        data: validatedData
      });
      this.calculateStats();
      this.trackDataChange(changeEvent.type, undefined, changeEvent.metadata);
      this.triggerAutoSave('data-change');
      this.safeUpdateUI();
    } catch (error) {
      this.toastService.error('Veri değişikliği işlenirken hata oluştu');
    }
    this.cdr.markForCheck();
  }

  private validateUpdatedData(updatedData: any[]): any[] | null {
    if (!Array.isArray(updatedData)) {
      return null;
    }
    try {
      return updatedData.filter((piece, index) => {
        if (!Array.isArray(piece) || piece.length < 6) {
          return false;
        }

        const [x, y, z, length, width, height] = piece;
        if ([x, y, z, length, width, height].some(val =>
          typeof val !== 'number' || isNaN(val) || val < 0)) {
          return false;
        }
        return true;
      });
    } catch (error) {
      return null;
    }
  }

  private analyzeDataChanges(oldData: any[], newData: any[]): {
    type: 'drag' | 'rotate' | 'delete' | 'restore' | 'unknown',
    metadata: any
  } {
    const oldCount = oldData?.length || 0;
    const newCount = newData?.length || 0;

    if (newCount < oldCount) {
      return {
        type: 'delete',
        metadata: {
          deletedCount: oldCount - newCount,
          remainingPackages: newCount,
          timestamp: new Date().toISOString()
        }
      };
    } else if (newCount > oldCount) {
      return {
        type: 'restore',
        metadata: {
          restoredCount: newCount - oldCount,
          totalPackages: newCount,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      const hasPositionChanges = this.detectPositionChanges(oldData, newData);
      const hasDimensionChanges = this.detectDimensionChanges(oldData, newData);

      if (hasDimensionChanges) {
        return {
          type: 'rotate',
          metadata: {
            rotatedPackages: hasDimensionChanges,
            timestamp: new Date().toISOString()
          }
        };
      } else if (hasPositionChanges) {
        return {
          type: 'drag',
          metadata: {
            movedPackages: hasPositionChanges,
            timestamp: new Date().toISOString()
          }
        };
      }
    }

    return {
      type: 'unknown',
      metadata: {
        oldCount,
        newCount,
        timestamp: new Date().toISOString()
      }
    };
  }

  private detectPositionChanges(oldData: any[], newData: any[]): number {
    let changes = 0;
    const tolerance = 1;

    newData.forEach((newPackage, index) => {
      const oldPackage = oldData[index];
      if (oldPackage && Array.isArray(oldPackage) && Array.isArray(newPackage)) {
        if (Math.abs(oldPackage[0] - newPackage[0]) > tolerance ||
            Math.abs(oldPackage[1] - newPackage[1]) > tolerance ||
            Math.abs(oldPackage[2] - newPackage[2]) > tolerance) {
          changes++;
        }
      }
    });

    return changes;
  }

  private detectDimensionChanges(oldData: any[], newData: any[]): number {
    let changes = 0;

    newData.forEach((newPackage, index) => {
      const oldPackage = oldData[index];
      if (oldPackage && Array.isArray(oldPackage) && Array.isArray(newPackage)) {
        // Compare dimensions (length, width, height)
        if (oldPackage[3] !== newPackage[3] ||
            oldPackage[4] !== newPackage[4] ||
            oldPackage[5] !== newPackage[5]) {
          changes++;
        }
      }
    });

    return changes;
  }

  private trackDataChange(
    type: 'drag' | 'rotate' | 'delete' | 'restore' | 'initial' | 'unknown',
    packageId?: number,
    metadata?: any
  ): void {
    const changeEvent: DataChangeEvent = {
      timestamp: new Date(),
      type: type,
      packageId: packageId,
      metadata: metadata
    };

    this.dataChangeHistory.push(changeEvent);
    if (this.dataChangeHistory.length > 50) {
      this.dataChangeHistory = this.dataChangeHistory.slice(-50);
    }

    this.updateLoadingStatsFromChange(type, metadata);
  }

  private updateLoadingStatsFromChange(
    type: 'drag' | 'rotate' | 'delete' | 'restore' | 'initial' | 'unknown',
    metadata?: any
  ): void {
    switch (type) {
      case 'drag':
        this.loadingStats.movedCount = (this.loadingStats.movedCount || 0) + (metadata?.movedPackages || 1);
        break;
      case 'rotate':
        this.loadingStats.rotatedCount = (this.loadingStats.rotatedCount || 0) + (metadata?.rotatedPackages || 1);
        break;
      case 'delete':
        this.loadingStats.deletedCount = (this.loadingStats.deletedCount || 0) + (metadata?.deletedCount || 1);
        break;
      case 'restore':
        this.loadingStats.deletedCount = Math.max(0,
          (this.loadingStats.deletedCount || 0) - (metadata?.restoredCount || 1));
        break;
    }
  }

  getDataChangeSummary(): {
    totalChanges: number;
    hasUnsavedChanges: boolean;
    lastChangeTime: Date;
    recentChanges: DataChangeEvent[];
  } {
    const recentChanges = this.dataChangeHistory.slice(-10).reverse();
    return {
      totalChanges: this.dataChangeHistory.length,
      hasUnsavedChanges: this.hasUnsavedChanges,
      lastChangeTime: this.lastDataChangeTime,
      recentChanges: recentChanges
    };
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
      `Toplam değişiklik: ${this.dataChangeHistory.length}\n\n` +
      '⚠️ Bu işlem geri alınamaz!'
    );

    if (!confirmed) return;
    try {
      this.piecesData = JSON.parse(JSON.stringify(this.originalPiecesData));
      this.dataChangeHistory = [];
      this.hasUnsavedChanges = false;

      this.safeProcessOptimizationResult({
        data: this.piecesData
      });

      this.calculateStats();

      this.loadingStats.deletedCount = 0;
      this.loadingStats.movedCount = 0;
      this.loadingStats.rotatedCount = 0;

      this.triggerAutoSave('data-change');

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
    this.dataChangeHistory = [];
    this.lastDataChangeTime = new Date();
    this.totalPackagesProcessed = 0;

    this.resetStats();
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
        this.calculateStats();
        this.totalPackagesProcessed = this.piecesData.length;
      } else {
        this.piecesData = [];
        this.processedPackages = [];
        this.totalPackagesProcessed = 0;
      }

      if (response?.stats) {
        this.algorithmStats = {
          executionTime: response.stats.execution_time || 0,
          generations: response.stats.generations || 0,
          bestFitness: response.stats.best_fitness || 0,
          iterationsCount: response.stats.iterations || 0,
          convergenceRate: response.stats.convergence_rate || 0
        };
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
      if ([x, y, z, length, width, height].some(val => typeof val !== 'number' || isNaN(val) || val < 0)) {

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
          color: this.getPackageColor(index),
          dimensions: `${piece[3] || 0}×${piece[4] || 0}×${piece[5] || 0}mm`,
        })
      );
    } catch (error) {
      this.processedPackages = [];
    }
  }

  private calculateStats(): void {
    if (this.isDestroyed || this.processedPackages.length === 0) {
      this.resetStats();
      return;
    }

    try {
      const totalVolume =
        this.truckDimension()[0] *
        this.truckDimension()[1] *
        this.truckDimension()[2];

      const usedVolume = this.processedPackages.reduce(
        (sum, pkg) => sum + pkg.length * pkg.width * pkg.height,
        0
      );

      const totalWeight = this.processedPackages.reduce(
        (sum, pkg) => sum + pkg.weight,
        0
      );

      const cogScore = this.calculateCOGScore();
      const utilizationRate = Math.round((usedVolume / totalVolume) * 100);
      const efficiency = Math.round((utilizationRate + cogScore) / 2);

      this.loadingStats = {
        ...this.loadingStats,
        totalPackages: this.processedPackages.length,
        packagesLoaded: this.processedPackages.length,
        utilizationRate: utilizationRate,
        cogScore: cogScore,
        totalWeight: Math.round(totalWeight),
        efficiency: efficiency,
      };

    } catch (error) {

      this.resetStats();
    }
  }

  private calculateCOGScore(): number {
    if (this.isDestroyed || this.processedPackages.length === 0) return 0;

    try {
      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;
      let weightedZ = 0;

      this.processedPackages.forEach((pkg) => {
        const centerX = pkg.x + pkg.length / 2;
        const centerY = pkg.y + pkg.width / 2;
        const centerZ = pkg.z + pkg.height / 2;

        totalWeight += pkg.weight;
        weightedX += centerX * pkg.weight;
        weightedY += centerY * pkg.weight;
        weightedZ += centerZ * pkg.weight;
      });

      if (totalWeight === 0) return 0;

      const cogX = weightedX / totalWeight;
      const cogY = weightedY / totalWeight;
      const cogZ = weightedZ / totalWeight;

      const idealX = this.truckDimension()[0] / 2;
      const idealY = this.truckDimension()[1] / 2;
      const idealZ = this.truckDimension()[2] * 0.4;

      const distance = Math.sqrt(
        Math.pow(cogX - idealX, 2) +
        Math.pow(cogY - idealY, 2) +
        Math.pow(cogZ - idealZ, 2)
      );

      const maxDistance = Math.sqrt(
        Math.pow(this.truckDimension()[0] / 2, 2) +
        Math.pow(this.truckDimension()[1] / 2, 2) +
        Math.pow(this.truckDimension()[2] * 0.6, 2)
      );

      const score = Math.round(Math.max(0, 100 - (distance / maxDistance) * 100));
      return score;
    } catch (error) {
      return 0;
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

    this.saveResultsToSession();

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

  onPackageSelected(packageData: any): void {
    if (this.isDestroyed) return;
    try {
      if (!packageData || !packageData.id) {

        return;
      }
      this.updatePackageInternalState(packageData);
      this.triggerAutoSave('user-action');
      this.updatePackageInteractionStats('selected');
    } catch (error) {
      this.toastService.error('Paket seçiminde hata oluştu');
    }
  }

  onViewChanged(viewType: string): void {
    if (this.isDestroyed) return;
    try {
      this.currentViewType = viewType;
      this.triggerAutoSave('user-action');
      this.cdr.detectChanges();
    } catch (error) {
    }
  }

  onThreeJSError(error: any): void {
    this.hasThreeJSError = true;
    this.showVisualization = false;
    this.toastService.error('3D görselleştirmede hata oluştu');
    this.cdr.detectChanges();
  }

  onThreeJSReady(): void {
    this.hasThreeJSError = false;
    this.cdr.detectChanges();
  }

  private updatePackageInternalState(packageData: any): void {
    try {
      const packageIndex = this.processedPackages.findIndex(pkg => pkg.id === packageData.id);

      if (packageIndex > -1) {
        const updatedPackage = {
          ...this.processedPackages[packageIndex],
          ...packageData,
          lastModified: new Date().toISOString()
        };
        this.processedPackages[packageIndex] = updatedPackage;
      }
    } catch (error) {
    }
  }

  private updatePackageInteractionStats(action: 'selected' | 'moved' | 'rotated' | 'deleted'): void {
    try {
      switch (action) {
        case 'moved':
          this.loadingStats.movedCount = (this.loadingStats.movedCount || 0) + 1;
          break;
        case 'rotated':
          this.loadingStats.rotatedCount = (this.loadingStats.rotatedCount || 0) + 1;
          break;
        case 'deleted':
          this.loadingStats.deletedCount = (this.loadingStats.deletedCount || 0) + 1;
          break;
      }

    } catch (error) {
    }
  }

  getUtilizationRate(): number {
    return this.loadingStats.utilizationRate;
  }

  getCogScore(): number {
    return this.loadingStats.cogScore;
  }

  getCogScoreClass(): string {
    const score = this.loadingStats.cogScore;
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'warning';
    return 'poor';
  }

  getEfficiencyClass(): string {
    const efficiency = this.loadingStats.efficiency;
    if (efficiency >= 85) return 'excellent';
    if (efficiency >= 70) return 'good';
    if (efficiency >= 50) return 'warning';
    return 'poor';
  }

  getChangeStatusClass(): string {
    if (!this.hasUnsavedChanges) return 'saved';
    if (this.dataChangeHistory.length > 10) return 'many-changes';
    if (this.dataChangeHistory.length > 0) return 'has-changes';
    return 'no-changes';
  }

  formatChangeType(changeType: string): string {
    const typeMap: { [key: string]: string } = {
      'drag': '🎯 Taşındı',
      'rotate': '🔄 Döndürüldü',
      'delete': '🗑️ Silindi',
      'restore': '➕ Geri Eklendi',
      'initial': '🚀 Başlangıç',
      'unknown': '❓ Bilinmeyen'
    };
    return typeMap[changeType] || changeType;
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

  private resetStats(): void {
    this.loadingStats = {
      totalPackages: 0,
      packagesLoaded: 0,
      utilizationRate: 0,
      cogScore: 0,
      totalWeight: 0,
      efficiency: 0,
      deletedCount: 0,
      movedCount: 0,
      rotatedCount: 0
    };
  }

  private getPackageColor(index: number): string {
    const colors = [
      '#006A6A', '#D6BB86', '#004A4A', '#C0A670', '#8b5cf6',
      '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
      '#14b8a6', '#fbbf24', '#8b5cf6', '#f87171', '#34d399',
      '#60a5fa', '#a78bfa', '#fb7185', '#fde047', '#67e8f9'
    ];
    return colors[index % colors.length];
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

  saveResults(): void {
    if (!this.hasResults || this.isDestroyed) {
      this.toastService.warning('Kaydetmek için önce optimizasyonu çalıştırın.');
      return;
    }

    try {
      const changeSummary = this.getDataChangeSummary();

      if(changeSummary.hasUnsavedChanges){
        this.repositoryService.partialUpdateOrderResult(this.piecesData, this.orderResultId)
        .pipe(
          switchMap(response => {
            return this.repositoryService.createTruckPlacementReport();
          }),tap(() => {
            this.hasUnsavedChanges = false;
            this.dataChangeHistory = []
          }),
          catchError(error => {
            this.toastService.error('İşlem sırasında hata oluştu:', error);
            return of(null);
          })
        )
        .subscribe({
          next: (response) => {
            this.reportFiles = this.reportFiles.filter(file =>
              !file.name.startsWith('Tır_Yerleşimi')
            );

            if (response && response.file) {
              this.reportFiles.push(response.file);
              this.cdr.detectChanges();
            }

            this.reportFiles.forEach(file => file.name);
          },
          error: (error) => {
            this.toastService.error('Hata:', error);
          },
          complete: () => {
            this.hasUnsavedChanges = false;
            this.toastService.success('Sonuçlar başarıyla kaydedildi.');
            this.triggerAutoSave('user-action');
          }
        });
      }
    } catch (error) {
      this.toastService.error('Sonuçlar kaydedilemedi.');
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

  completeShipment(): void {
    if (!this.hasResults) {
      this.toastService.warning('Önce optimizasyonu tamamlayın');
      return;
    }

    const changeSummary = this.getDataChangeSummary();
    const confirmMessage = 'Sevkiyat tamamlanacak, onaylıyor musunuz?'

    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

    try {
      this.saveResultsToSession();
      this.localStorageService.clearStorage();
      this.store.dispatch(resetStepper());
      this.resetComponentState();

      this.toastService.success(
        `Sevkiyat başarıyla tamamlandı! ${changeSummary.totalChanges} değişiklik kaydedildi.`,
        'Tamamlandı!'
      );

      setTimeout(() => {
        this.shipmentCompleted.emit();
      }, 1500);

    } catch (error) {
      this.toastService.error('Sevkiyat tamamlanırken hata oluştu');
    }
  }

  private resetComponentState(): void {
    this.hasResults = false;
    this.showVisualization = false;
    this.isLoading = false;
    this.hasThreeJSError = false;
    this.piecesData = [];
    this.originalPiecesData = []; // NEW
    this.reportFiles = [];
    this.optimizationProgress = 0;
    this.processedPackages = [];
    this.currentViewType = 'isometric';

    this.hasUnsavedChanges = false;
    this.dataChangeHistory = [];
    this.lastDataChangeTime = new Date();
    this.totalPackagesProcessed = 0;

    this.resetStats();

    this.algorithmStats = {
      executionTime: 0,
      generations: 0,
      bestFitness: 0,
      iterationsCount: 0,
      convergenceRate: 0
    };

    this.performanceMetrics = {
      startTime: 0,
      endTime: 0,
      memoryUsage: 0,
      renderTime: 0,
      dataChangeCount: 0,
      averageResponseTime: 0
    };
  }
}
