import { createFeatureSelector, createSelector, MemoizedSelector, State } from '@ngrx/store';
import { StepperState } from './stepper.state';
import { UiPackage } from '../../features/stepper/components/ui-models/ui-package.model';
import { toInteger } from 'lodash';
import { deepEqual, areOrderDetailsEqual } from '../../features/stepper/components/invoice-upload/helpers/order-detail.helper';
import { arePackageListsEqual, calculatePackageChanges } from '../../features/stepper/components/pallet-control/package-changes.helper';
import { UiPallet } from '../../features/stepper/components/ui-models/ui-pallet.model';
import { PackageDetailWriteDto } from '@app/features/interfaces/package-detail.interface';
import { mapUiPackagesToPackageWriteDtoList, mapUiPackageToPackageWriteDto } from '@app/features/mappers/package.mapper';
import { PackageWriteDto } from '@app/features/interfaces/package.interface';

// Feature selector
export const selectStepperState = createFeatureSelector<StepperState>('stepper');


// #region STEPPER STATE SELECTORS

export const selectOrder = createSelector(selectStepperState, (stepper) => stepper.order)
export const selectOriginalOrder = createSelector(
  selectStepperState,
  (state) => state.originalOrder
);

export const selectHasRevisedOrder = createSelector(
  selectStepperState,
  (state) => state.hasRevisedOrder
);

// #endregion

// #region STEP1 SELECTORS

export const selectStep1State = createSelector(
  selectStepperState,
  (state) => state.step1State
);

export const selectOrderDetails = createSelector(
  selectStep1State,
  (step1State) => {
    return [...step1State.orderDetails].sort((a, b) => {
      // 1. product.product_type.type
      if (a.product?.product_type?.type !== b.product?.product_type?.type) {
        return (a.product?.product_type?.type || '').localeCompare(
          b.product?.product_type?.type || ''
        );
      }

      // 2. product.product_type.code
      if (a.product?.product_type?.code !== b.product?.product_type?.code) {
        return (a.product?.product_type?.code || '').localeCompare(
          b.product?.product_type?.code || ''
        );
      }

      // 3. product.dimension.width
      if (a.product?.dimension?.width !== b.product?.dimension?.width) {
        return (a.product?.dimension?.width || 0) - (b.product?.dimension?.width || 0);
      }

      // 4. product.dimension.depth
      return (a.product?.dimension?.depth || 0) - (b.product?.dimension?.depth || 0);
    });
  }
);

export const selectOriginalOrderDetails = createSelector(
  selectStep1State,
  (step1State) => step1State.originalOrderDetails
);


export const selectOrderDetailsChanges = createSelector(
  selectStep1State,
  (step1State) => ({
    added: step1State.added,
    modified: step1State.modified,
    deletedIds: step1State.deletedIds
  })
);


export const selectStep1HasFile = createSelector(
  selectStep1State,
  (step1State) => step1State.hasFile
);

export const selectStep1FileName = createSelector(
  selectStep1State,
  (step1State) => step1State.fileName
);

export const selectInvoiceTemplateFile = createSelector(
  selectStep1State,
  (step1State) => step1State.templateFile
);

export const selectFileExists = createSelector(
  selectStepperState,
  (state) => state.fileExists
)

// #endregion


// #region  STEP2 SELECTORS

export const selectStep2State = createSelector(
  selectStepperState,
  (state) => state.step2State
);

/**
 * Selects the plain object representation of remainingProducts
 * from the Step2 state.
 *
 *
 * @returns {Array<Object>} Array of plain UiProduct objects
 */
export const selectRemainingProducts = createSelector(
  selectStep2State,
  (step2State) => step2State.remainingProducts
);


/**
 * Selects the plain object representation of packages
 * from the Step2 state.
 *
 * Note:
 * - The returned objects are plain, not instances of UiPackage.
 * - They do not contain the `ui_id` field, because packages
 *   are unique and `ui_id` is not needed.
 *
 * @returns {Array<Object>} Array of plain package objects
 */
export const selectPackages = createSelector(
  selectStep2State,
  (step2State) => step2State.packages
);


/**
 * Returns an array of UiPackage instances
 * mapped from the state.packages array.
 *
 * Each UiPackage is a copy of the original
 * package from the Step2 state.
 */
export const selectUiPackages = createSelector(selectStep2State, (state) =>
  state.packages.map((uiPackage: any) => new UiPackage({ ...uiPackage }))
);

/**
 * Selects packages that have a pallet assigned and contain at least one product.
 *
 * @selector
 * @returns {UiPackage[]} Filtered list of valid packages.
 */
export const selectValidPackages = createSelector(
  selectUiPackages,
  (packages) => packages.filter(pkg => pkg.pallet && pkg.package_details?.length > 0)
);

/**
 * Returns an array of UiPallet instances
 * mapped from the state.pallets array.
 */
export const selectUiPallets = createSelector(selectStep2State, (state) =>
  state.pallets.map((uiPallet: any) => new UiPallet({ ...uiPallet }))
)


// #region STEP2 DERIVED SELECTORS
//

export const hasRemainingProduct = createSelector(selectStep2State, (state) => state.remainingProducts.length > 0)
export const uiPackageCount = createSelector(selectStep2State, (state) => state.packages.length)
export const hasPackages = createSelector(selectStep2State, (state) => state.packages.length > 0)
export const remainingProductCount = createSelector(selectStep2State, (state) => state.remainingProducts.length)

export const allDropListIds = createSelector(selectPackages, (packages) => {
  const ids = ['productsList', 'availablePalletsList'];

  // Package container'ları ekle (boş paketler için)
  packages
    .filter(pkg => pkg.pallet === null)
    .forEach(pkg => ids.push(pkg.id));

  // Pallet container'ları ekle
  packages
    .filter(pkg => pkg.pallet !== null)
    .forEach(pkg => {
      if (pkg.pallet) {
        ids.push(pkg.pallet.id);
      }
    });
  return ids;
});

export const packageDropListIds = createSelector(selectPackages, (packages) => {
  return packages
    .filter(pkg => pkg.pallet === null)
    .map(pkg => pkg.id);
});

export const palletDropListIds = createSelector(selectPackages, (packages) => {
  const ids = ['productsList'];
  packages
    .filter(pkg => pkg.pallet !== null)
    .forEach(pkg => {
      if (pkg.pallet) {
        ids.push(pkg.pallet.ui_id);
      }
    });
  return ids;
});

export const selectStep2Changes = createSelector(
  selectStep2State,
  (step2State) => ({
    added: step2State.addedPackages,
    modified: step2State.modifiedPackages,
    deleted: step2State.deletedPackageIds
  })
);

export const selectOriginalPackages = createSelector(
  selectStep2State,
  (step2State) => step2State.originalPackages
);

// #region STEP2 PACKAGE CHANGES SELECTORS (YENİ BÖLÜM)

/**
 * Step2 için isDirty hesaplar
 *
 * Mantık:
 * - originalPackages boş ise → false (henüz hiç kaydedilmemiş, dirty değil temiz)
 * - originalPackages dolu ise → packages ile karşılaştır
 *
 * NOT: İlk calculate'ten sonra packages dolu ama originalPackages boş
 * Bu durumda false döner çünkü henüz DB'ye kaydedilmemiş (added durumu)
 *
 * @returns boolean - Step2 dirty mi?
 */
export const selectIsPackagesDirty = createSelector(
  selectPackages,
  selectOriginalPackages,
  selectRemainingProducts,
  (packages, originalPackages, remainingProducts) => {

    if (!packages || packages.length === 0) {
      return false;
    }

    if (remainingProducts.length > 0){
      return true;
    }

    // Orijinal paketler yoksa dirty değil (henüz kaydedilmemiş)
    if (!originalPackages || originalPackages.length === 0) {
      return true;
    }

    const isEqual = arePackageListsEqual(packages, originalPackages);

    return !isEqual;
  }
);

/**
 * Paket değişikliklerini hesaplar (added, modified, deleted)
 *
 * Bu selector her çağrıldığında değişiklikleri yeniden hesaplar.
 * State'te tutmak yerine on-demand hesaplama yapar.
 *
 * NOT: Selector memoization sayesinde packages veya originalPackages
 * değişmedikçe yeniden hesaplama yapmaz (performans optimizasyonu)
 *
 * @returns PackageChanges - { added, modified, deleted }
 */
export const selectPackageChanges = createSelector(
  selectPackages, // UiPackage instance'ları döner
  selectOriginalPackages,
  (packages, originalPackages) => {

    // Original packages yoksa tümü added
    if (!originalPackages || originalPackages.length === 0) {
      return {
        added: mapUiPackagesToPackageWriteDtoList(packages),
        modified: [],
        deletedIds: []
      };
    }

    // Helper ile değişiklikleri hesapla
    const changes = calculatePackageChanges(packages, originalPackages);

    return changes;
  }
);

/**
 * Added packages selector
 *
 * Sadece eklenen paketleri döndürür
 */
export const selectAddedPackages = createSelector(
  selectPackageChanges,
  (changes) => changes.added
);

// #endregion

export const selectVerticalSort = createSelector(
  selectStep2State,
  (step2State) => step2State.verticalSort
);

export const selectStep2PackageCount = createSelector(
  selectPackages,
  (packages) => packages.length
);


/**
 * Calculates the weight of each valid package according to the order's weight type.
 *
 * @selector
 * @returns {number[]} List of individual package weights.
 */
export const selectPackageWeightList = createSelector(
  selectValidPackages,
  selectOrder,
  (packages, order) => {
    if (!order?.weight_type) return [];
    return packages.map(pkg => packageTotalWeight(pkg, order.weight_type));
  }
);



/**
 * Computes the total weight of all valid packages.
 *
 * @selector
 * @returns {number} Total weight of all packages.
 */
export const selectTotalPackageWeight = createSelector(
  selectPackageWeightList,
  (weights) => {
    const total = weights.reduce((sum, w) => sum + w, 0);
    return Math.round(total * 100) / 100;
  }
);


export const selectRemainingWeight = createSelector(
  selectOrder,
  selectTotalPackageWeight,
  (order, totalWeight) => {
    if (order) {
      const trailerWeightLimit = Number(order.truck_weight_limit) || 0;
      const remaining = trailerWeightLimit - totalWeight;

      // Sonucu noktadan sonra 2 haneye yuvarla
      return Math.round(remaining * 100) / 100;
    }
    return 0;
  }
);

export const selectTotalProductsMeter = createSelector(selectOrderDetails, (orderDetails) => {
  return orderDetails.reduce((total: number, detail: any) => {
    const depth = detail.product?.dimension?.depth || 0;
    const count = detail.count || 0;
    return (total + (depth * count) / 1000)
  }, 0);
})

export const selectTotalPackagesMeter = createSelector(selectPackages, (packages) => {

  const totalMm = packages.reduce((total, pkg) => {
    if (pkg.package_details.length === 0) return total;

    const packageMeter = pkg.package_details.reduce((pTotal: any, packageDetail: any) => {
      const productDepth = Number(packageDetail.product.dimension?.depth) || 0;
      const count = Number(packageDetail.count) || 0;
      return pTotal + (count * productDepth);
    }, 0);

    return total + packageMeter;
  }, 0);

  const totalMeter = totalMm / 1000;

  // Sonucu noktadan sonra 2 haneye yuvarla
  return Math.round(totalMeter * 100) / 100;
});

// #endregion

// #endregion




// Basic selectors
export const selectCurrentStep = createSelector(
  selectStepperState,
  (state) => state.currentStep
);


export const selectCompletedStep = createSelector(
  selectStepperState,
  (state) => state.completedStep
);

// Edit Mode selectors
export const selectIsEditMode = createSelector(
  selectStepperState,
  (state) => state.isEditMode
);

export const selectStepperError = createSelector(
  selectStepperState,
  (state) => state.error
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

// Global Error Management Selectors
export const selectGlobalError = createSelector(
  selectStepperState,
  (state) => state.globalError
);

export const selectHasGlobalError = createSelector(
  selectGlobalError,
  (error) => error !== null
);


export const selectTruck: MemoizedSelector<any, [number, number, number]> = createSelector(
  selectOrder,
  (order) => {
    if (!order) return [0, 0, 0];
    return order.truck
      ? [
        toInteger(order.truck.dimension.width),
        toInteger(order.truck.dimension.depth),
        toInteger(order.truck.dimension.height)
      ]
      : [0, 0, 0]

  }
);

export const selectOrderId = createSelector(selectOrder, (order) => order?.id || '')



export const selectAverageOrderDetailHeight = createSelector(
  selectOrderDetails,
  (orderDetails) => {
    if (!orderDetails || orderDetails.length === 0) {
      return 0;
    }

    const totalHeight = orderDetails.reduce((sum, orderDetail) => {
      const height = toInteger(orderDetail?.product?.dimension?.height) || 0;
      return sum + height;
    }, 0);

    const averageOrderDetailHeight = toInteger(totalHeight / orderDetails.length);
    if (averageOrderDetailHeight < 120) {
      return 120;
    }
    return toInteger(totalHeight / orderDetails.length);
  }
)

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

function packageTotalWeight(pkg: UiPackage, weightType: string): number {
  const palletWeight = Math.floor(pkg.pallet?.weight ?? 0);
  const productsWeight = pkg.package_details.reduce(
    (total, packageDetail) => {
      if (weightType == 'std') {
        return total + Math.floor(packageDetail.product.weight_type.std * packageDetail.count);
      }
      else if (weightType == 'eco') {
        return total + Math.floor(packageDetail.product.weight_type.eco * packageDetail.count);
      }
      else {
        return total + Math.floor(packageDetail.product.weight_type.pre * packageDetail.count);
      }
    }, 0
  );

  return palletWeight + productsWeight;
  // NOTE:
  // fucntion icerisinde yuvarlama yapilmamali selectorlarin icinde nihai sonuc uretilince
  // yuvarlama yapilmali cunku birden fazla package icin bu method kullanilir ise
  // yuvarlama yuzunden hatali sonuc uretilir.
}

export const selectTotalProductCount = createSelector(
  selectOrderDetails,
  (orderDetails) => orderDetails.reduce((sum, od) => sum + od.count, 0)
);


export const selectHeaviestPackageWeight = createSelector(
  selectPackageWeightList,
  (activePalletWeights) => {
    const weights = activePalletWeights.map(w => Number(w) || 0);
    if (weights.length === 0) return 0;
    const maxWeight = Math.max(...weights);
    return Math.round(maxWeight * 100) / 100;
  }
);

export const selectLightestPackageWeight = createSelector(
  selectPackageWeightList,
  (activePalletWeights) => {
    const weights = activePalletWeights.map(w => Number(w) || 0);
    if (weights.length === 0) return 0;
    const minWeight = Math.min(...weights);
    return Math.round(minWeight * 100) / 100;
  }
);

export const selectAveragePackageWeight = createSelector(
  selectPackageWeightList,
  (activePalletWeights) => {
    const weights = activePalletWeights.map(w => Number(w) || 0);
    if (weights.length === 0) return 0;
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return Math.round((totalWeight / weights.length) * 100) / 100;
  }
);

export const selectNonEmptyPackageCount = createSelector(selectPackageWeightList, (packageWeights) =>
  packageWeights.length
);


// Step3 Migration Selectors (Step2 selectors'ların altına ekle)
export const selectStep3State = createSelector(
  selectStepperState,
  (state) => state.step3State
);

export const selectOrderResult = createSelector(
  selectStep3State,
  (step3State) => step3State.orderResult
);

export const selectOrderResultId = createSelector(
  selectStepperState,
  (state) => state.orderResultId
);
export const selectStep3ReportFiles = createSelector(
  selectStep3State,
  (step3State) => step3State.reportFiles
);

export const selectIsOrderDirty = createSelector(selectStepperState, (state) => {
  if (!state.originalOrder) return true;
  if (!state.order) return true;
  return !deepEqual(state.order, state.originalOrder);
}
);

export const selectIsOrderDetailsDirty = createSelector(
  selectOrderDetails,
  selectOriginalOrderDetails,
  (orderDetails, originalOrderDetails) => {
    if (!originalOrderDetails || originalOrderDetails.length === 0) {
      return true;
    }
    return !areOrderDetailsEqual(orderDetails, originalOrderDetails);
  }
);

export const selectCompanyRelationId = createSelector(
  selectOrder,
  (order) => {
    const id = order?.company_relation?.id;
    return id != null ? id.toString() : '';
  }
);

export const selectStep3IsDirty = createSelector(
  selectStep3State,
  (step3State) => step3State.isDirty
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

