import { createFeatureSelector, createSelector } from '@ngrx/store';
import { StepperState } from './stepper.state';
import { Order } from '../../models/order.interface';
import { UiPackage } from '../../admin/components/stepper/components/ui-models/ui-package.model';
import { toInteger } from 'lodash-es';

// Feature selector
export const selectStepperState = createFeatureSelector<StepperState>('stepper');

// Step1 Migration Selectors
export const selectStep1State = createSelector(
  selectStepperState,
  (state) => state.step1State
);


// Step2 Migration Selectors
export const selectStep2State = createSelector(
  selectStepperState,
  (state) => state.step2State
);

export const selectFileExists = createSelector(
  selectStepperState,
  (state) => state.fileExists
)

export const selectUiPackages = createSelector(selectStepperState, (state) =>
  state.step2State.packages.map((uiPackage: any) => new UiPackage({ ...uiPackage }))
);

export const hasRemainingProduct = createSelector(selectStep2State, (state) => state.remainingProducts.length > 0)
export const uiPackageCount = createSelector(selectStep2State, (state) => state.packages.length)
export const hasPackage = createSelector(selectStep2State, (state) => state.packages.length > 0)
export const remainingProductCount = createSelector(selectStep2State, (state) => state.remainingProducts.length)

export const allDropListIds = createSelector(selectStep2State, (state) => {
  const ids = ['productsList', 'availablePalletsList'];

  // Package container'ları ekle (boş paketler için)
  state.packages
    .filter(pkg => pkg.pallet === null)
    .forEach(pkg => ids.push(pkg.id));

  // Pallet container'ları ekle
  state.packages
    .filter(pkg => pkg.pallet !== null)
    .forEach(pkg => {
      if (pkg.pallet) {
        ids.push(pkg.pallet.id);
      }
    });
  return ids;
});

export const packageDropListIds = createSelector(selectStep2State, (state) => {
  return state.packages
    .filter(pkg => pkg.pallet === null)
    .map(pkg => pkg.id);
});

export const palletDropListIds = createSelector(selectStep2State, (state) => {
  const ids = ['productsList'];
  state.packages
    .filter(pkg => pkg.pallet !== null)
    .forEach(pkg => {
      if (pkg.pallet) {
        ids.push(pkg.pallet.id);
      }
    });
  return ids;
});

// Basic selectors
export const selectCurrentStep = createSelector(
  selectStepperState,
  (state) => state.currentStep
);


export const selectCompletedStep = createSelector(
  selectStepperState,
  (state) => state.completedStep
);

export const selectStepValidations = createSelector(
  selectStepperState,
  (state) => state.stepValidations
);

// Edit Mode selectors
export const selectIsEditMode = createSelector(
  selectStepperState,
  (state) => state.isEditMode
);


// Step Data selectors
export const selectStepData = createSelector(
  selectStepperState,
  (state) => state.stepData
);

export const selectStepDataByNumber = (stepNumber: number) => createSelector(
  selectStepData,
  (stepData) => stepData[`step${stepNumber + 1}` as keyof typeof stepData]
);

// UI State selectors
export const selectStepperLoading = createSelector(
  selectStepperState,
  (state) => state.loading
);

export const selectStepperError = createSelector(
  selectStepperState,
  (state) => state.error
);


export const selectIsStepValid = (stepIndex: number) => createSelector(
  selectStepValidations,
  (validations) => validations[stepIndex] || false
);



// Complex selectors
export const selectStepperSummary = createSelector(
  selectCurrentStep,
  selectCompletedStep,
  selectIsEditMode,
  (currentStep, completedStep, isEditMode) => ({
    currentStep,
    completedStep,
    isEditMode,
    totalSteps: 3,
    progressPercentage: Math.round((completedStep / 3) * 100)
  })
);

// Auto-Save Selectors
export const selectAutoSaveState = createSelector(
  selectStepperState,
  (state) => state.autoSave
);

export const selectStepAutoSave = (stepNumber: number) => createSelector(
  selectAutoSaveState,
  (autoSave) => autoSave[stepNumber]
);

export const selectStepAutoSaveStatus = (stepNumber: number) => createSelector(
  selectStepAutoSave(stepNumber),
  (stepAutoSave) => stepAutoSave?.status || 'idle'
);

export const selectStepLastSaved = (stepNumber: number) => createSelector(
  selectStepAutoSave(stepNumber),
  (stepAutoSave) => stepAutoSave?.lastSaved
);

export const selectStepAutoSaveError = (stepNumber: number) => createSelector(
  selectStepAutoSave(stepNumber),
  (stepAutoSave) => stepAutoSave?.error
);

export const selectStepHasPendingChanges = (stepNumber: number) => createSelector(
  selectStepAutoSave(stepNumber),
  (stepAutoSave) => stepAutoSave?.pendingChanges || false
);

// Combined Auto-Save Selectors
export const selectIsAnySaving = createSelector(
  selectAutoSaveState,
  (autoSave) => Object.values(autoSave).some(step => step.status === 'saving')
);

export const selectAnyAutoSaveErrors = createSelector(
  selectAutoSaveState,
  (autoSave) => Object.values(autoSave).some(step => step.status === 'error')
);

export const selectAutoSaveSummary = createSelector(
  selectAutoSaveState,
  (autoSave) => ({
    step0: autoSave[0],
    step1: autoSave[1],
    step2: autoSave[2],
    isAnySaving: Object.values(autoSave).some(step => step.status === 'saving'),
    hasErrors: Object.values(autoSave).some(step => step.status === 'error'),
    totalPendingChanges: Object.values(autoSave).filter(step => step.pendingChanges).length
  })
);

// Helper selector for UI display
export const selectAutoSaveStatusText = (stepNumber: number) => createSelector(
  selectStepAutoSaveStatus(stepNumber),
  selectStepLastSaved(stepNumber),
  selectStepAutoSaveError(stepNumber),
  (status, lastSaved, error) => {
    switch (status) {
      case 'saving':
        return 'Kaydediliyor...';
      case 'saved':
        return lastSaved ? `Kaydedildi: ${new Date(lastSaved).toLocaleTimeString()}` : 'Kaydedildi';
      case 'error':
        return `Hata: ${error || 'Bilinmeyen hata'}`;
      case 'idle':
      default:
        return '';
    }
  }
);

// Global Error Management Selectors
export const selectGlobalError = createSelector(
  selectStepperState,
  (state) => state.globalError
);

export const selectHasGlobalError = createSelector(
  selectGlobalError,
  (error) => error !== null
);

export const selectRetryAttempts = createSelector(
  selectStepperState,
  (state) => state.retryAttempts
);

export const selectStepRetryCount = (stepIndex: number) => createSelector(
  selectRetryAttempts,
  (retryAttempts) => retryAttempts[stepIndex] || 0
);

export const selectCanRetry = (stepIndex: number) => createSelector(
  selectStepRetryCount(stepIndex),
  (retryCount) => retryCount < 3 // Max 3 retry
);

// Step Loading Selectors
export const selectStepLoading = createSelector(
  selectStepperState,
  (state) => state.stepLoading
);

export const selectStepLoadingState = (stepIndex: number) => createSelector(
  selectStepLoading,
  (stepLoading) => stepLoading[stepIndex]
);

export const selectIsStepLoading = (stepIndex: number) => createSelector(
  selectStepLoadingState(stepIndex),
  (loadingState) => loadingState?.isLoading || false
);

export const selectStepProgress = (stepIndex: number) => createSelector(
  selectStepLoadingState(stepIndex),
  (loadingState) => loadingState?.progress
);

export const selectStepLoadingMessage = (stepIndex: number) => createSelector(
  selectStepLoadingState(stepIndex),
  (loadingState) => loadingState?.message
);

export const selectAnyStepLoading = createSelector(
  selectStepLoading,
  (stepLoading) => Object.values(stepLoading).some(step => step.isLoading)
);


export const selectOrder = createSelector(selectStepperState, (stepper) => stepper.order)


export const selectOrderId = createSelector(selectOrder, (order) => order?.id)

export const selectStep1OrderDetails = createSelector(
  selectStep1State,
  (step1State) => step1State.orderDetails
);

export const selectAverageOrderDetailHeight = createSelector(
  selectStep1OrderDetails,
  (orderDetails) => {
    if (!orderDetails || orderDetails.length === 0) {
      return 0;
    }

    const totalHeight = orderDetails.reduce((sum, orderDetail) => {
      const height = toInteger(orderDetail?.product?.dimension?.height) || 0;
      return sum + height;
    }, 0);

    return totalHeight / orderDetails.length;
  }
)

export const selectStep1Original = createSelector(
  selectStep1State,
  (step1State) => step1State.originalOrderDetails
);

export const selectStep1Changes = createSelector(
  selectStep1State,
  (step1State) => ({
    added: step1State.added,
    modified: step1State.modified,
    deleted: step1State.deleted
  })
);

export const selectStep1IsDirty = createSelector(
  selectStep1State,
  (step1State) => step1State.isDirty
);

export const selectStep1HasFile = createSelector(
  selectStep1State,
  (step1State) => step1State.hasFile
);

export const selectStep1FileName = createSelector(
  selectStep1State,
  (step1State) => step1State.fileName
);


export const selectStep2Packages = createSelector(
  selectStep2State,
  (step2State) => step2State.packages
);

export const selectStep2RemainingProducts = createSelector(
  selectStep2State,
  (step2State) => step2State.remainingProducts
);

export const selectStep2OriginalPackages = createSelector(
  selectStep2State,
  (step2State) => step2State.originalPackages
);

export const selectStep2Changes = createSelector(
  selectStep2State,
  (step2State) => ({
    added: step2State.addedPackages,
    modified: step2State.modifiedPackages,
    deleted: step2State.deletedPackages
  })
);

export const selectStep2IsDirty = createSelector(
  selectStep2State,
  (step2State) => step2State.isDirty
);

export const selectStep2PackageCount = createSelector(
  selectStep2Packages,
  (packages) => packages.length
);

export const selectStep2ProductCount = createSelector(
  selectStep2RemainingProducts,
  (products) => products.length
);

export const selectTotalWeight = createSelector(
  selectUiPackages,
  selectOrder,
  (packages, order) => {
    if (packages.length === 0) return 0;

    return packages.reduce((total, pkg) => {
      const palletWeight = Math.floor(pkg.pallet?.weight ?? 0);
      const productsWeight = pkg.products.reduce((pTotal: any, product: any) => {
        let weight = 0;
        if (order?.weight_type === 'eco') {
          weight = product.weight_type.eco;
        } else if (order?.weight_type === 'std') {
          weight = product.weight_type.std;
        } else if (order?.weight_type === 'pre') {
          weight = product.weight_type.pre;
        }
        return pTotal + Math.floor(weight * product.count);
      }, 0);
      return total + palletWeight + productsWeight;
    }, 0);
  }
);

export const selectRemainingWeight = createSelector(
  selectOrder,
  selectTotalWeight,
  (order, totalWeight) => {
    if (order) {
      const trailerWeightLimit = order.truck?.weight_limit ?? 0;
      return Math.floor(trailerWeightLimit - totalWeight);
    }
    return 0;
  }
);

export const selectTotalMeter = createSelector(selectUiPackages, (uiPackages) => {
  const packages = uiPackages
  return packages.reduce((total, pkg) => {
    if (pkg.products.length === 0) return total;

    const packageMeter = pkg.products.reduce((pTotal: any, product: any) => {
      const productDepth = product.dimension?.depth ?? 0;
      return pTotal + Math.round(Math.floor(product.count * Math.floor(productDepth)));
    }, 0);

    return total + packageMeter;
  }, 0) / 1000;
});

export const selectRemainingArea = createSelector(selectUiPackages, selectOrder, (uiPackages, order) => {
  const packages = uiPackages;
  const totalArea = packages.reduce((total, pkg) => {
    const palletArea = Math.floor(
      (pkg.pallet?.dimension.width ?? 0) * (pkg.pallet?.dimension.depth ?? 0)
    );
    return total + palletArea;
  }, 0);

  let trailerArea = 0;
  if (order) {
    trailerArea = (order.truck?.dimension?.width ?? 0) * (order.truck?.dimension?.depth ?? 0);
  }

  return Math.floor((trailerArea - totalArea) / 1000000);
});

function packageTotalWeight(pkg: UiPackage, order: Order): number {
  const palletWeight = Math.floor(pkg.pallet?.weight ?? 0);
  const productsWeight = pkg.products.reduce(
    (total, product) => {
      if (!order) { return 0; }
      if (order.weight_type == 'std') {
        return total + Math.floor(product.weight_type.std * product.count);
      }
      else if (order.weight_type == 'eco') {
        return total + Math.floor(product.weight_type.eco * product.count);
      }
      else {
        return total + Math.floor(product.weight_type.pre * product.count);
      }
    }, 0
  );

  return palletWeight + productsWeight;
}

export const selectActivePalletWeights = createSelector(selectUiPackages, selectOrder, (uiPackages, order) => {
  const packages = uiPackages;
  return packages
    .filter(pkg => pkg.pallet && pkg.products?.length > 0)
    .map(pkg => packageTotalWeight(pkg, order));
});

export const selectHeaviestPalletWeight = createSelector(selectActivePalletWeights, (activePalletWeights) => {
  const weights = activePalletWeights;
  return weights.length > 0 ? Math.max(...weights) : 0;
});

export const selectLightestPalletWeight = createSelector(selectActivePalletWeights, (activePalletWeights) => {
  const weights = activePalletWeights;
  return weights.length > 0 ? Math.min(...weights) : 0;
});

export const selectAveragePalletWeight = createSelector(selectActivePalletWeights, (activePalletWeights) => {
  const weights = activePalletWeights;
  if (weights.length === 0) return 0;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return Math.round((totalWeight / weights.length) * 100) / 100;
});

export const selectActivePalletCount = createSelector(selectActivePalletWeights, (activePalletWeights) =>
  activePalletWeights.length);

export const selectTotalPalletWeight = createSelector(selectActivePalletWeights, (activePalletWeights) =>
  activePalletWeights.reduce((sum, weight) => sum + weight, 0)
);


// Step3 Migration Selectors (Step2 selectors'ların altına ekle)
export const selectStep3State = createSelector(
  selectStepperState,
  (state) => state.step3State
);

export const selectStep3OptimizationResult = createSelector(
  selectStep3State,
  (step3State) => step3State.optimizationResult
);

export const selectStep3ReportFiles = createSelector(
  selectStep3State,
  (step3State) => step3State.reportFiles
);

export const selectStep3LoadingStats = createSelector(
  selectStep3State,
  (step3State) => step3State.loadingStats
);

export const selectStep3AlgorithmStats = createSelector(
  selectStep3State,
  (step3State) => step3State.algorithmStats
);

export const selectStep3HasResults = createSelector(
  selectStep3State,
  (step3State) => step3State.hasResults
);

export const selectStep3ShowVisualization = createSelector(
  selectStep3State,
  (step3State) => step3State.showVisualization
);

export const selectStep3HasUnsavedChanges = createSelector(
  selectStep3State,
  (step3State) => step3State.hasUnsavedChanges
);

export const selectStep3IsDirty = createSelector(
  selectStep3State,
  (step3State) => step3State.isDirty
);

export const selectStep3DataChangeHistory = createSelector(
  selectStep3State,
  (step3State) => step3State.dataChangeHistory
);

// Step3 Enhanced Selectors (mevcut Step3 selector'larından sonra ekle)
export const selectStep3CurrentViewType = createSelector(
  selectStep3State,
  (step3State) => step3State.currentViewType
);

export const selectStep3HasThreeJSError = createSelector(
  selectStep3State,
  (step3State) => step3State.hasThreeJSError
);

export const selectStep3ProcessedPackages = createSelector(
  selectStep3State,
  (step3State) => step3State.processedPackages
);

export const selectStep3Summary = createSelector(
  selectStep3HasResults,
  selectStep3ShowVisualization,
  selectStep3HasUnsavedChanges,
  selectStep3IsDirty,
  selectStep3ProcessedPackages,
  (hasResults, showVisualization, hasUnsavedChanges, isDirty, processedPackages) => ({
    hasResults,
    showVisualization,
    hasUnsavedChanges,
    isDirty,
    totalPackages: processedPackages.length,
    canSave: hasUnsavedChanges && hasResults
  })
);
