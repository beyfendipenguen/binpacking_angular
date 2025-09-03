import { createReducer, on } from '@ngrx/store';
import { StepperState, initialStepperState } from './stepper.state';
import * as StepperActions from './stepper.actions';
import { update } from 'lodash';
import { UiPackage } from '../../admin/components/dashboard/stepper/components/ui-models/ui-package.model';
import { v4 as Guid } from 'uuid';
import { UiPallet } from '../../admin/components/dashboard/stepper/components/ui-models/ui-pallet.model';
import { UiProduct } from '../../admin/components/dashboard/stepper/components/ui-models/ui-product.model';
import { IUiProduct } from '../../admin/components/dashboard/stepper/interfaces/ui-interfaces/ui-product.interface';

export let cloneCount = 1;

export const stepperReducer = createReducer(
  initialStepperState,
  on(StepperActions.setOrderDetails, (state, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      isDirty: false
    }
  })),

  on(StepperActions.setRemainingProducts,(state,{remainingProducts})=>(
    {
      ...state,
      step2State:{
        ...state.step2State,
        remainingProducts:[...remainingProducts]
      }
    }
  )),

  on(StepperActions.calculatePackageDetailSuccess, (state, { packages, remainingOrderDetails }) => (
    {
      ...state,
      step2State: {
        ...state.step2State,
        packages: [...packages],
        originalPackages:[...packages],
        remainingProducts: [...remainingOrderDetails]
      }
    }
  )),
  on(StepperActions.removePalletFromPackage, (state, { pkg}) => {

    if (!pkg.pallet) return state;

    let updatedRemainingProducts;
    if (pkg.products?.length > 0) {
      const uiProducts = pkg.products;
      const currentRemainingProducts = state.step2State.remainingProducts;
      updatedRemainingProducts = [...currentRemainingProducts, ...uiProducts];
    }

    const currentPackages = state.step2State.packages;
    const updatedPackages = currentPackages.map(pkg =>
      pkg.id === pkg.id ? { ...pkg, pallet: null, products: [] } : pkg
    ) as UiPackage[];

    return {
      ...state,
      step2State:{
        ...state.step2State,
        remainingProducts: updatedRemainingProducts || state.step2State.remainingProducts,
        packages: updatedPackages
      
      }
    }
  }),

  on(StepperActions.remainingProductMoveProduct, (state, { previousIndex, currentIndex }) => {
    const updatedRemainingProducts = [...state.step2State.remainingProducts]
    const [removed] = updatedRemainingProducts.splice(previousIndex, 1);
    updatedRemainingProducts.splice(currentIndex, 0, removed);
    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts
      }
    }
  }),

  on(StepperActions.moveProductToRemainingProducts, (state, { uiProducts,previousIndex,previousContainerId }) => {
    const sourceProducts = [...uiProducts];
    const removedProduct = sourceProducts.splice(previousIndex, 1)[0];

    const currentRemainingProducts = state.step2State.remainingProducts; // Store'dan mevcut array'i al
    const updatedRemainingProducts = [...currentRemainingProducts, removedProduct];

    const currentPackages = state.step2State.packages;
    const sourcePackage = currentPackages.find(pkg =>
      pkg.pallet && pkg.pallet.id === previousContainerId
    );

    if (sourcePackage) {
      const updatedPackages = currentPackages.map(pkg =>
        pkg.id === sourcePackage.id ? { ...pkg, products: sourceProducts } : pkg
    ) as UiPackage[];

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts,
        packages: updatedPackages
      }}
    }
    return state
  }),

  on(StepperActions.setStepperData, (state, { data }) => ({
    ...state,
    ...data
  })),

  on(StepperActions.createOrderDetailsSuccess, (state, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      added: [],
      isDirty: state.step1State.modified.length > 0 || state.step1State.deleted.length > 0,
    }
  })),

  on(StepperActions.setOrder, (state, { order }) => ({
    ...state,
    order: order
  })),

  on(StepperActions.updateOrCreateOrderSuccess, (state, { order }) => ({
    ...state,
    order: order
  })),


  on(StepperActions.setUiPackages, (state, {  packages }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      packages: [...packages],
      originalPackages: [...packages],
      isDirty: false
    }
  })),

  on(StepperActions.moveRemainingProductFromPackage, (state, {  targetPackage,previousIndex }) => {

    const sourceProducts = [...state.step2State.remainingProducts];
    const targetProducts = [...targetPackage.products];

    const removedProduct = sourceProducts.splice(previousIndex, 1)[0];
    targetProducts.push(removedProduct);

    const updatedPackage = { ...targetPackage, products: targetProducts };
    const updatedPackages = state.step2State.packages.map(pkg =>
      pkg.id === updatedPackage.id ? updatedPackage : pkg
    ) as UiPackage[];

    const isOriginal = state.step2State.originalPackages.some(item => item.id === updatedPackage.id);
    const isAlreadyModified = state.step2State.modifiedPackages.some(item => item.id === updatedPackage.id);

    let modified = [...state.step2State.modifiedPackages];
    if (isOriginal && !isAlreadyModified) {
      modified.push(updatedPackage);
    } else if (isAlreadyModified) {
      modified = modified.map(item => item.id === updatedPackage.id ? updatedPackage : item);
    }

    return {
    ...state,
    step2State: {
      ...state.step2State,
      packages: [...updatedPackages],
      remainingProducts: [...sourceProducts],
      modifiedPackages: [...modified],
      isDirty: true
    }}
  }),

  on(StepperActions.movePalletToPackage, (state,{containerId,previousIndex,previousContainerData}) => {
    const currentPackages = state.step2State.packages;
    const targetPackage = currentPackages.find(p => p.id === containerId);
    if (!targetPackage) return state;

    const originalPallet = previousContainerData[previousIndex];
    const palletClone = new UiPallet({
      ...originalPallet,
      id: originalPallet.id + '/' + cloneCount++,
    });

    const updatedPackages = currentPackages.map(pkg =>
      pkg.id === targetPackage.id ? { ...targetPackage, pallet: palletClone } : pkg
    ) as UiPackage[];

    const updatedPackage = {
      ...targetPackage,
      pallet: palletClone
    }

    const isOriginal = state.step2State.originalPackages.some(item => item.id === updatedPackage.id);
    const isAlreadyModified = state.step2State.modifiedPackages.some(item => item.id === updatedPackage.id);

    let modified = [...state.step2State.modifiedPackages];
    if (isOriginal && !isAlreadyModified) {
      modified.push(updatedPackage);
    } else if (isAlreadyModified) {
      modified = modified.map(item => item.id === updatedPackage.id ? updatedPackage : item);
    }

    return {
    ...state,
    step2State: {
      ...state.step2State,
      packages: [...updatedPackages],
      modifiedPackages: [...modified],
      isDirty: true
    }}
  }),

  on(StepperActions.removeProductFromPackage, (state,{pkg,productIndex}) => {
    const currentPackages = state.step2State.packages;
    const currentRemainingProducts = state.step2State.remainingProducts;

    const productToRemove = pkg.products[productIndex];
    if (!productToRemove) return state;

    const updatedPackageProducts = [...pkg.products];
    const removedProduct = updatedPackageProducts.splice(productIndex, 1)[0];

    const updatedPackage = { ...pkg, products: updatedPackageProducts };
    const updatedPackages = currentPackages.map(p =>
      p.id === pkg.id ? updatedPackage : p
    ) as UiPackage[];

    const updatedRemainingProducts = [...currentRemainingProducts, removedProduct];

    return {
    ...state,
    step2State: {
      ...state.step2State,
      packages: [...updatedPackages],
      remainingProducts: [...updatedRemainingProducts],
      isDirty: true
    }}
  }),

  on(StepperActions.removeAllPackage, (state) => {
    const allProducts: UiProduct[] = [];

    for (const pkg of state.step2State.packages) {
      if (pkg.products?.length > 0) {
        const uiProducts = pkg.products.map((product: any) =>
          product instanceof UiProduct ? product : new UiProduct(product)
        );
        allProducts.push(...uiProducts);
      }
    }

    const remainingProducts = consolidateProducts([
      ...state.step2State.remainingProducts,
      ...allProducts
    ]);

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: [],
        remainingProducts,
        isDirty: true
      }
    };
  }),

  on(StepperActions.removePackage, (state, { packageToRemove }) => {
    const currentPackages = state.step2State.packages;
    const packageIndex = currentPackages.findIndex(
      (pkg) => pkg.id === packageToRemove.id
    );

    if (packageIndex === -1) {
      return state;
    }

    const packageToDelete = currentPackages[packageIndex];
    const updatedPackages = currentPackages.filter((_, index) => index !== packageIndex);

    let remainingProducts = state.step2State.remainingProducts;

    if (packageToDelete.products?.length > 0) {
      const allProducts = [...remainingProducts, ...packageToDelete.products];
      remainingProducts = consolidateProducts(allProducts);
    }

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: updatedPackages,
        remainingProducts,
        isDirty: true
      }
    };
  }),

  on(StepperActions.splitProduct, (state, { product, splitCount }) => {

    if (!(product instanceof UiProduct)) {
      product = new UiProduct(product);
    }

    if (product.count <= 1) {
      return state;
    }

    const currentProducts = state.step2State.remainingProducts;
    let validatedCount: number;
    let isCustomSplit = false;

    if (splitCount !== undefined && splitCount !== null) {

      if (splitCount <= 0 || splitCount >= product.count) {
        return state;
      }
      validatedCount = splitCount;
      isCustomSplit = true;
    } else {

      validatedCount = Math.floor(product.count / 2);
      isCustomSplit = false;
    }

    let remainingProducts: UiProduct[];

    if (isCustomSplit) {

      const firstPart = new UiProduct({
        ...product,
        count: validatedCount,
        id: `${product.id}/1`,
      });

      const secondPart = new UiProduct({
        ...product,
        count: product.count - validatedCount,
        id: `${product.id}/2`,
      });

      remainingProducts = currentProducts.filter(p => p.id !== product.id);
      remainingProducts.push(firstPart, secondPart);
    } else {

      if (typeof product.split !== 'function') {
        console.warn('Product does not have split method');
        return state;
      }

      const splitProducts = product.split();
      if (!splitProducts || splitProducts.length === 0) {
        console.warn('Split method returned invalid result');
        return state;
      }

      remainingProducts = currentProducts.filter(p => p.id !== product.id);
      remainingProducts.push(...splitProducts);
    }

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: [...remainingProducts],
        isDirty: true
      }
    };
  }),

  on(StepperActions.moveUiProductInPackageToPackage, (state, {  sourcePackage,targetPackage,previousIndex }) => {

    if (sourcePackage.id === targetPackage.id) {
      return state;
    }

    const sourceProducts = [...sourcePackage.products];
    const targetProducts = [...targetPackage.products];
    const [removedProduct] = sourceProducts.splice(previousIndex, 1);

    targetProducts.push(removedProduct);

    const updatedSourcePackage = { ...sourcePackage, products: sourceProducts };
    const updatedTargetPackage = { ...targetPackage, products: targetProducts };

    const updatedPackages = state.step2State.packages.map(pkg => {
      if (pkg.id === sourcePackage.id) return updatedSourcePackage;
      if (pkg.id === targetPackage.id) return updatedTargetPackage;
      return pkg;
    }) as UiPackage[];

    let modifiedPackages = [...state.step2State.modifiedPackages];

    const isSourceOriginal = state.step2State.originalPackages.some(item => item.id === updatedSourcePackage.id);
    const isSourceAlreadyModified = modifiedPackages.some(item => item.id === updatedSourcePackage.id);

    if (isSourceOriginal && !isSourceAlreadyModified) {
      modifiedPackages.push(updatedSourcePackage);
    } else if (isSourceAlreadyModified) {
      modifiedPackages = modifiedPackages.map(item =>
        item.id === updatedSourcePackage.id ? updatedSourcePackage : item
      );
    }

    const isTargetOriginal = state.step2State.originalPackages.some(item => item.id === updatedTargetPackage.id);
    const isTargetAlreadyModified = modifiedPackages.some(item => item.id === updatedTargetPackage.id);

    if (isTargetOriginal && !isTargetAlreadyModified) {
      modifiedPackages.push(updatedTargetPackage);
    } else if (isTargetAlreadyModified) {
      modifiedPackages = modifiedPackages.map(item =>
        item.id === updatedTargetPackage.id ? updatedTargetPackage : item
      );
    }

    return {
    ...state,
    step2State: {
      ...state.step2State,
      packages: updatedPackages,
      modifiedPackages: modifiedPackages,
      isDirty: true
    }}
  }),



  on(StepperActions.moveUiProductInSamePackage, (state, { containerId,currentIndex,previousIndex }) => {
    const currentPackages = state.step2State.packages;
    const targetPackageIndex = currentPackages.findIndex(pkg =>
      pkg.pallet && pkg.pallet.id === containerId
    );

    if (targetPackageIndex !== -1) {
      // 1. Orijinal paketler dizisinin bir kopyasını oluşturun.
      const updatedPackages = [...currentPackages];

      // 2. Hedef paketin bir kopyasını oluşturun.
      const targetPackage = { ...updatedPackages[targetPackageIndex] };

      // 3. Ürünler dizisinin bir kopyasını oluşturun ve değişiklikleri bu kopya üzerinde yapın.
      const updatedProducts = [...targetPackage.products];
      const [removed] = updatedProducts.splice(previousIndex, 1);
      updatedProducts.splice(currentIndex, 0, removed);

      // 4. Güncellenmiş önceliklerle yeni bir ürünler dizisi oluşturun.
      const productsWithUpdatedPriority = updatedProducts.map((product: any, index: number) => ({
        ...product,
        priority: index
      }));

      // 5. Kopyalanan paketteki ürünler dizisini yeni diziyle değiştirin.
      targetPackage.products = productsWithUpdatedPriority;

      // 6. Kopyalanan paketler dizisinde ilgili paketi güncelleyin.
      updatedPackages[targetPackageIndex] = targetPackage;

      // 7. Yalnızca yeni state objesini döndürün.
      return {
        ...state,
        step2State: {
          ...state.step2State,
          packages: updatedPackages
        }
      };
    }

    return state;
  }),

  on(StepperActions.navigateToStep, (state, { stepIndex }) => ({
    ...state,
    currentStep: stepIndex,
    error: null
  })),

  on(StepperActions.setStepCompleted, (state, { stepIndex }) => ({
    ...state,
    completedStep: stepIndex
  })),

  on(StepperActions.setStepValidation, (state, { stepIndex, isValid }) => ({
    ...state,
    stepValidations: {
      ...state.stepValidations,
      [stepIndex]: isValid
    }
  })),

  on(StepperActions.enableEditMode, (state, { orderId }) => ({
    ...state,
    isEditMode: true
  })),

  on(StepperActions.disableEditMode, (state) => ({
    ...state,
    isEditMode: false,
    editOrderId: null
  })),

  on(StepperActions.setStepData, (state, { stepNumber, data }) => ({
    ...state,
    stepData: {
      ...state.stepData,
      [`step${stepNumber + 1}`]: data
    }
  })),

  on(StepperActions.clearStepData, (state, { stepNumber }) => {
    if (stepNumber !== undefined) {
      const newStepData = { ...state.stepData };
      delete newStepData[`step${stepNumber + 1}` as keyof typeof newStepData];
      return {
        ...state,
        stepData: newStepData
      };
    }
    // Tüm step data'yı temizle
    return {
      ...state,
      stepData: {}
    };
  }),

  on(StepperActions.resetStepper, () => ({
    ...initialStepperState
  })),

  on(StepperActions.initializeStepper, (state, { editMode, editOrderId }) => ({
    ...state,
    isEditMode: editMode || false,
    editOrderId: editOrderId || null,
    availableSteps: editMode ? [0, 1, 2] : [0],
    completedSteps: editMode ? [0, 1, 2] : [],
    error: null
  })),

  on(StepperActions.setStepperLoading, (state, { loading }) => ({
    ...state,
    loading
  })),

  on(StepperActions.setStepperError, (state, { error }) => ({
    ...state,
    error,
    loading: false
  })),

  on(StepperActions.triggerAutoSave, (state, { stepNumber }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        ...state.autoSave[stepNumber],
        status: 'saving' as const,
        pendingChanges: true,
        error: null
      }
    }
  })),

  on(StepperActions.performAutoSave, (state, { stepNumber }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        ...state.autoSave[stepNumber],
        status: 'saving' as const
      }
    }
  })),

  on(StepperActions.autoSaveSuccess, (state, { stepNumber, timestamp }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        ...state.autoSave[stepNumber],
        status: 'saved' as const,
        lastSaved: timestamp,
        pendingChanges: false,
        error: null
      }
    }
  })),

  on(StepperActions.autoSaveFailure, (state, { stepNumber, error }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        ...state.autoSave[stepNumber],
        status: 'error' as const,
        error: error,
        pendingChanges: true
      }
    }
  })),

  on(StepperActions.setAutoSaveStatus, (state, { stepNumber, status }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        ...state.autoSave[stepNumber],
        status: status
      }
    }
  })),

  on(StepperActions.clearAutoSaveStatus, (state, { stepNumber }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        status: 'idle' as const,
        lastSaved: null,
        error: null,
        pendingChanges: false
      }
    }
  })),

  on(StepperActions.forceSave, (state, { stepNumber }) => ({
    ...state,
    autoSave: {
      ...state.autoSave,
      [stepNumber]: {
        ...state.autoSave[stepNumber],
        status: 'saving' as const,
        pendingChanges: true
      }
    }
  })),

  on(StepperActions.setGlobalError, (state, { error }) => ({
    ...state,
    globalError: {
      ...error,
      timestamp: new Date()
    }
  })),

  on(StepperActions.clearGlobalError, (state) => ({
    ...state,
    globalError: null
  })),

  on(StepperActions.retryOperation, (state, { stepIndex }) => ({
    ...state,
    retryAttempts: {
      ...state.retryAttempts,
      [stepIndex]: (state.retryAttempts[stepIndex] || 0) + 1
    },
    globalError: null // Retry'da error'ı temizle
  })),

  on(StepperActions.setStepLoading, (state, { stepIndex, loading, operation }) => ({
    ...state,
    stepLoading: {
      ...state.stepLoading,
      [stepIndex]: {
        ...state.stepLoading[stepIndex],
        isLoading: loading,
        operation: loading ? operation : undefined,
        progress: loading ? state.stepLoading[stepIndex]?.progress : undefined,
        message: loading ? state.stepLoading[stepIndex]?.message : undefined
      }
    }
  })),

  on(StepperActions.setStepProgress, (state, { stepIndex, progress, message }) => ({
    ...state,
    stepLoading: {
      ...state.stepLoading,
      [stepIndex]: {
        ...state.stepLoading[stepIndex],
        progress,
        message
      }
    }
  })),

  on(StepperActions.clearStepProgress, (state, { stepIndex }) => ({
    ...state,
    stepLoading: {
      ...state.stepLoading,
      [stepIndex]: {
        ...state.stepLoading[stepIndex],
        progress: undefined,
        message: undefined
      }
    }
  })),

  on(StepperActions.initializeStep1State, (state, { order, orderDetails, hasFile, fileName }) => ({
    ...state,
    step1State: {
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      added: [],
      modified: [],
      deleted: [],
      hasFile,
      fileName,
      isDirty: false
    }
  })),

  on(StepperActions.resetStep1Changes, (state) => ({
    ...state,
    step1State: {
      ...state.step1State,
      added: [],
      modified: [],
      deleted: [],
      isDirty: false
    }
  })),

  on(StepperActions.syncStep1WithBackend, (state, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails], // Yeni original data
      added: [], // Temizle
      modified: [], // Temizle
      deleted: [], // Temizle
      isDirty: false // Clean state
    }
  })),

  on(StepperActions.initializeStep1StateFromUpload, (state, { order, orderDetails, hasFile, fileName }) => ({
    ...state,
    order,
    step1State: {
      orderDetails: [...orderDetails],
      originalOrderDetails: [], // File upload'da original yok
      added: [...orderDetails], // File'dan gelen tüm data added
      modified: [],
      deleted: [],
      hasFile,
      fileName,
      isDirty: true // File upload'ta dirty true
    }
  })),

  on(StepperActions.updateStep1OrderDetails, (state, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      isDirty: true
    }
  })),

  on(StepperActions.addOrderDetail, (state, { orderDetail }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...state.step1State.orderDetails, orderDetail],
      added: [...state.step1State.added, orderDetail],
      isDirty: true
    }
  })),

  on(StepperActions.updateOrderDetail, (state, { orderDetail }) => {
    const orderDetails = state.step1State.orderDetails.map(detail =>
      detail.id === orderDetail.id ? orderDetail : detail
    );

    const isOriginal = state.step1State.originalOrderDetails.some(item => item.id === orderDetail.id);
    const isAlreadyModified = state.step1State.modified.some(item => item.id === orderDetail.id);

    let modified = [...state.step1State.modified];
    if (isOriginal && !isAlreadyModified) {
      modified.push(orderDetail);
    } else if (isAlreadyModified) {
      modified = modified.map(item => item.id === orderDetail.id ? orderDetail : item);
    }

    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails,
        modified,
        isDirty: true
      }
    };
  }),

  on(StepperActions.deleteOrderDetail, (state, { orderDetailId }) => {
    const itemToDelete = state.step1State.orderDetails.find(item => item.id === orderDetailId);
    const orderDetails = state.step1State.orderDetails.filter(item => item.id !== orderDetailId);
    const isOriginal = state.step1State.originalOrderDetails.some(item => item.id === orderDetailId);
    const deleted = isOriginal && itemToDelete ? [...state.step1State.deleted, itemToDelete] : state.step1State.deleted;
    const added = state.step1State.added.filter(item => item.id !== orderDetailId);
    const modified = state.step1State.modified.filter(item => item.id !== orderDetailId);
    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails,
        added,
        modified,
        deleted,
        isDirty: true
      }
    };
  }),

  on(StepperActions.initializeStep2State, (state, { packages, remainingProducts }) => ({
    ...state,
    step2State: {
      packages: [...packages],
      remainingProducts: [...remainingProducts],
      originalPackages: [...packages],
      originalRemainingProducts: [...remainingProducts],
      addedPackages: [],
      modifiedPackages: [],
      deletedPackages: [],
      isDirty: false
    }
  })),

  on(StepperActions.updateStep2Packages, (state, { packages }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      packageDetils: [...packages],
      isDirty: true
    }
  })),

  on(StepperActions.addPackage, (state, { package: newPackage }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      packages: [...state.step2State.packages, newPackage],
      addedPackages: [...state.step2State.addedPackages, newPackage],
      isDirty: true
    }
  })),

  on(StepperActions.deletePackage, (state, { packageId }) => {
    const itemToDelete = state.step2State.packages.find(item => item.id === packageId);
    const packages = state.step2State.packages.filter(item => item.id !== packageId);

    const isOriginal = state.step2State.originalPackages.some(item => item.id === packageId);
    const deleted = isOriginal && itemToDelete ? [...state.step2State.deletedPackages, itemToDelete] : state.step2State.deletedPackages;
    const added = state.step2State.addedPackages.filter(item => item.id !== packageId);
    const modified = state.step2State.modifiedPackages.filter(item => item.id !== packageId);

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: packages,
        addedPackages: added,
        modifiedPackages: modified,
        deletedPackages: deleted,
        isDirty: true
      }
    };
  }),


  on(StepperActions.initializeStep3State, (state, { optimizationResult, reportFiles, loadingStats, algorithmStats }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      optimizationResult: [...optimizationResult],
      reportFiles: [...reportFiles],
      loadingStats: loadingStats || state.step3State.loadingStats,
      algorithmStats: algorithmStats || state.step3State.algorithmStats,
      hasResults: optimizationResult.length > 0 || reportFiles.length > 0,
      showVisualization: optimizationResult.length > 0,
      isDirty: false
    }
  })),

  on(StepperActions.updateStep3OptimizationResult, (state, { optimizationResult }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      optimizationResult: [...optimizationResult],
      hasResults: optimizationResult.length > 0,
      showVisualization: optimizationResult.length > 0,
      hasUnsavedChanges: true,
      isDirty: true
    }
  })),

  on(StepperActions.updateStep3ReportFiles, (state, { reportFiles }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      reportFiles: [...reportFiles],
      isDirty: true
    }
  })),

  on(StepperActions.updateStep3LoadingStats, (state, { loadingStats }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      loadingStats: loadingStats,
      isDirty: true
    }
  })),

  on(StepperActions.updateStep3AlgorithmStats, (state, { algorithmStats }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      algorithmStats: algorithmStats,
      isDirty: true
    }
  })),

  on(StepperActions.setStep3HasResults, (state, { hasResults }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      hasResults: hasResults,
      showVisualization: hasResults,
      isDirty: true
    }
  })),

  on(StepperActions.updateStep3DataChangeHistory, (state, { changes }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      dataChangeHistory: [...changes],
      isDirty: true
    }
  })),

  on(StepperActions.setStep3ThreeJSError, (state, { hasError, errorMessage }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      hasThreeJSError: hasError,
      showVisualization: !hasError,
      isDirty: true
    },
    globalError: hasError ? {
      message: errorMessage || 'ThreeJS visualization error',
      stepIndex: 2,
      timestamp: new Date()
    } : state.globalError
  })),

  on(StepperActions.setStep3ViewType, (state, { viewType }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      currentViewType: viewType,
      isDirty: true
    }
  })),

  on(StepperActions.setStep3UnsavedChanges, (state, { hasUnsavedChanges }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      hasUnsavedChanges: hasUnsavedChanges,
      isDirty: hasUnsavedChanges
    }
  })),

  on(StepperActions.updateStep3ProcessedPackages, (state, { processedPackages }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      processedPackages: [...processedPackages],
      isDirty: true
    }
  })),


);
//helper fn
const consolidateProducts = (products: UiProduct[]): UiProduct[] => {
  const consolidatedMap = new Map<string, UiProduct>();

  for (const product of products) {
    const mainId = product.id.split('/')[0];
    const existing = consolidatedMap.get(mainId);

    if (existing) {
      existing.count += product.count;
    } else {
      consolidatedMap.set(
        mainId,
        new UiProduct({
          ...product,
          id: mainId,
        })
      );
    }
  }

  return Array.from(consolidatedMap.values());
};


