import { createReducer, on } from '@ngrx/store';
import { initialStepperState } from './stepper.state';
import * as StepperActions from './stepper.actions';
import { v4 as Guid } from 'uuid';
import { mapPackageDetailToPackage } from '../../models/mappers/package-detail.mapper';
import { UiPackage } from '../../admin/components/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '../../admin/components/stepper/components/ui-models/ui-pallet.model';
import { UiProduct } from '../../admin/components/stepper/components/ui-models/ui-product.model';
import { isEqual } from 'lodash-es';

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

  on(StepperActions.deleteRemainingProduct, (state, { product }) => {
    const remainingProducts = state.step2State.remainingProducts;
    const orderDetails = state.step1State.orderDetails;
    const originalOrderDetails = state.step1State.originalOrderDetails;
    const added = state.step1State.added;
    const modified = state.step1State.modified;
    const deleted = state.step1State.deleted;

    // Remaining products'tan kaldır
    const updatedRemainingProducts = remainingProducts.filter(p => p.ui_id !== product.ui_id);

    // Bu ürün added listesinde mi
    const isInAdded = added.some(od => od.product.id === product.id);

    // Bu ürün modified listesinde mi
    const isInModified = modified.some(od => od.product.id === product.id);

    // Order details'ı güncelle (miktarı azalt veya tamamen kaldır)
    const updatedOrderDetails = orderDetails.map(od => {
      if (od.product.id === product.id) {
        return { ...od, count: od.count - product.count };
      }
      return od;
    }).filter(od => od.count > 0);

    // Added listesini güncelle (eğer bu ürün added listesindeyse)
    const updatedAdded = added.map(od => {
      if (od.product.id === product.id) {
        return { ...od, count: od.count - product.count };
      }
      return od;
    }).filter(od => od.count > 0);

    // Modified ve deleted listelerini güncelle
    let updatedModified = [...modified];
    let updatedDeleted = [...deleted];

    // Eğer ürün added listesindeyse
    if (isInModified) {
      // Eğer ürün modified listesindeyse
      const modifiedIndex = updatedModified.findIndex(od => od.product.id === product.id);
      if (modifiedIndex >= 0) {
        const currentModifiedCount = updatedModified[modifiedIndex].count;
        const newCount = currentModifiedCount - product.count;

        if (newCount <= 0) {
          // Modified'daki miktar 0'ın altına düştü
          // Modified'dan kaldır ve deleted'a ekle (çünkü orijinal DB kaydı tamamen silinmiş)
          updatedModified = updatedModified.filter((_, index) => index !== modifiedIndex);

          const originalOrderDetail = originalOrderDetails.find(od => od.product.id === product.id);
          if (originalOrderDetail) {
            const existingDeletedIndex = updatedDeleted.findIndex(od => od.product.id === product.id);

            if (existingDeletedIndex >= 0) {
              // Zaten deleted listesinde varsa, miktarını güncelle
              updatedDeleted[existingDeletedIndex] = {
                ...originalOrderDetail,
                count: originalOrderDetail.count // Tüm orijinal miktar silinmiş
              };
            } else {
              // Deleted listesine ekle
              updatedDeleted.push({
                ...originalOrderDetail,
                count: originalOrderDetail.count // Tüm orijinal miktar silinmiş
              });
            }
          }
        } else {
          // Modified'daki miktarı azalt
          updatedModified[modifiedIndex] = {
            ...updatedModified[modifiedIndex],
            count: newCount
          };
        }
      }

    } else {
      // Ürün ne added'da ne de modified'da değil - orijinal listeden geliyor
      const originalOrderDetail = originalOrderDetails.find(od => od.product.id === product.id);
      if (originalOrderDetail) {
        const currentOrderDetail = orderDetails.find(od => od.product.id === product.id);
        const currentCount = currentOrderDetail ? currentOrderDetail.count : 0;
        const newCount = currentCount - product.count;

        if (newCount <= 0) {
          // Orijinal ürün tamamen silindi - deleted'a ekle
          const existingDeletedIndex = updatedDeleted.findIndex(od => od.product.id === product.id);

          if (existingDeletedIndex >= 0) {
            // Zaten deleted listesinde varsa, miktarını güncelle
            updatedDeleted[existingDeletedIndex] = {
              ...originalOrderDetail,
              count: originalOrderDetail.count // Tüm orijinal miktar silinmiş
            };
          } else {
            // Deleted listesine ekle
            updatedDeleted.push({
              ...originalOrderDetail,
              count: originalOrderDetail.count // Tüm orijinal miktar silinmiş
            });
          }
        } else {
          // Orijinal ürün kısmen silindi - modified'a ekle
          const existingModifiedIndex = updatedModified.findIndex(od => od.product.id === product.id);

          if (existingModifiedIndex >= 0) {
            // Zaten modified listesinde varsa güncelle
            updatedModified[existingModifiedIndex] = {
              ...updatedModified[existingModifiedIndex],
              count: newCount
            };
          } else {
            // Modified listesine ekle
            updatedModified.push({
              ...originalOrderDetail,
              count: newCount
            });
          }
        }
      }
    }

    const isDirty = (
      updatedOrderDetails.length !== originalOrderDetails.length ||
      updatedOrderDetails.some(od => {
        const original = originalOrderDetails.find(ood => ood.product.id === od.product.id);
        return !original || original.count !== od.count;
      }) ||
      updatedAdded.length > 0 ||
      updatedDeleted.length > 0
    );

    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails: updatedOrderDetails,
        originalOrderDetails: [...state.step1State.originalOrderDetails],
        added: updatedAdded,
        modified: updatedModified,
        deleted: updatedDeleted
      },
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts
      }
    };
  }),

  on(StepperActions.setRemainingProducts, (state, { remainingProducts }) => (
    {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: [...remainingProducts]
      }
    }
  )),

  on(StepperActions.addUiProductToRemainingProducts, (state, { product }) => {
    const remainingProducts = state.step2State.remainingProducts;

    // Check if a product with the same base ID already exists.
    const alreadyExists = remainingProducts.some(p => p.ui_id === product.ui_id);

    if (alreadyExists) {
      // If a product with the same base ID exists, do nothing as per the original logic's intent.
      return state;
    }
    const newProduct = new UiProduct({
      ...product,
      count: 1,
    });

    return { ...state, step2State: { ...state.step2State, remainingProducts: [...remainingProducts, newProduct], isDirty: true } };
  }),

  on(StepperActions.calculatePackageDetailSuccess, (state, { packages, remainingOrderDetails }) => (
    {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(packages, state.order),
        originalPackages: [...packages],
        remainingProducts: [...remainingOrderDetails],
        isDirty: true
      }
    }
  )),

  on(StepperActions.removePalletFromPackage, (state, { pkg }) => {

    if (!pkg.pallet) return state;

    let updatedRemainingProducts;
    if (pkg.products?.length > 0) {
      const uiProducts = pkg.products;
      const currentRemainingProducts = state.step2State.remainingProducts;
      updatedRemainingProducts = [...currentRemainingProducts, ...uiProducts];
    }

    const currentPackages = state.step2State.packages;
    const updatedPackages = currentPackages.map(uiPackage =>
      uiPackage.id === pkg.id ? { ...pkg, pallet: null, products: [] } : uiPackage
    ) as UiPackage[];

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts || state.step2State.remainingProducts,
        packages: updatedPackages

      }
    }
  }),

  on(StepperActions.palletControlSubmitSuccess, (state, { packageDetails }) => {
    const uiPackages = mapPackageDetailToPackage(packageDetails);
    return {
      ...state,
      completedStep: 2,
      currentStep: 3,
      step2State: {
        ...state.step2State,
        packgages: uiPackages,
        originalPackages: uiPackages,
        addedPackages: [],
        modifiedPackages: [],
        deletedPackages: [],
        isDirty: false,
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

  on(StepperActions.moveProductToRemainingProducts, (state, { uiProducts, previousIndex, previousContainerId }) => {
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
        pkg.id === sourcePackage.id ? new UiPackage({ ...pkg, products: sourceProducts }) : pkg
      ) as UiPackage[];

      return {
        ...state,
        step2State: {
          ...state.step2State,
          remainingProducts: updatedRemainingProducts,
          packages: updatedPackages
        }
      }
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
      deleted: [],
      modified: [],
      isDirty: false,
    }
  })),

  on(StepperActions.setOrder, (state, { order }) => ({
    ...state,
    order: order,
    step1State: {
      ...state.step1State,
      isOnlyOrderDirty: true
    }
  })),

  on(StepperActions.updateOrCreateOrderSuccess, (state, { order }) => ({
    ...state,
    order: order,
    step1State: {
      ...state.step1State,
      isOnlyOrderDirty: false
    }
  })),

  on(StepperActions.setUiPackages, (state, { packages }) => {

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(packages, state.order),
        originalPackages: [...packages],
        isDirty: false
      }
    }
  }),

  on(StepperActions.moveRemainingProductToPackage, (state, { targetPackage, previousIndex }) => {

    const sourceProducts = [...state.step2State.remainingProducts];
    const targetProducts = [...targetPackage.products];

    const removedProduct = sourceProducts.splice(previousIndex, 1)[0];

    const existingProductIndex = targetProducts.findIndex(p =>
      p.id === removedProduct.id
    );

    if (existingProductIndex !== -1) {
      targetProducts[existingProductIndex] = new UiProduct({
        ...targetProducts[existingProductIndex],
        count: targetProducts[existingProductIndex].count + removedProduct.count
      });
    } else {
      targetProducts.push(new UiProduct({
        ...removedProduct,
      }));
    }

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
        packages: ensureEmptyPackageAdded([...updatedPackages], state.order),
        remainingProducts: [...sourceProducts],
        modifiedPackages: [...modified],
        isDirty: true
      }
    }
  }),

  on(StepperActions.movePalletToPackage, (state, { containerId, previousIndex, previousContainerData }) => {
    const currentPackages = state.step2State.packages;
    const targetPackage = currentPackages.find(p => p.id === containerId);
    if (!targetPackage) return state;

    const originalPallet = previousContainerData[previousIndex];

    const basePalletId = originalPallet.id.split('/')[0];

    const existingCount = currentPackages.filter(pkg =>
      pkg.pallet && pkg.pallet.id.startsWith(basePalletId)
    ).length;

    const newPalletId = existingCount === 0
      ? basePalletId
      : `${basePalletId}/${existingCount + 1}`;

    const palletClone = new UiPallet({
      ...originalPallet,
      id: newPalletId,
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
      }
    }
  }),

  on(StepperActions.removeProductFromPackage, (state, { pkg, productIndex }) => {
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
      }
    }
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
        packages: ensureEmptyPackageAdded([], state.order),
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
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts,
        isDirty: true
      }
    };
  }),

  on(StepperActions.setFileExists, (state) => ({
    ...state,
    fileExists: !state.fileExists
  })),

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
      });

      const secondPart = new UiProduct({
        ...product,
        count: product.count - validatedCount,
      });

      remainingProducts = currentProducts.filter(p => p.ui_id !== product.ui_id);
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

      remainingProducts = currentProducts.filter(p => p.ui_id !== product.ui_id);
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

  on(StepperActions.moveUiProductInPackageToPackage, (state, { sourcePackage, targetPackage, previousIndex }) => {

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
      }
    }
  }),



  on(StepperActions.moveUiProductInSamePackage, (state, { containerId, currentIndex, previousIndex }) => {
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
  on(StepperActions.updateProductCountAndCreateOrUpdateOrderDetail, (state, { product, newCount }) => {

    const existingOrderDetailIndex = state.step1State.orderDetails.findIndex(
      orderDetail => orderDetail.product.id === product.id
    );

    const existingRemainingProductIndex = state.step2State.remainingProducts.findIndex(
      item => item.ui_id === product.ui_id
    );

    let updatedRemainingProducts = [...state.step2State.remainingProducts];

    if (existingOrderDetailIndex !== -1) {

      if (existingRemainingProductIndex !== -1) {
        updatedRemainingProducts = updatedRemainingProducts.map((p, i) =>
          i === existingRemainingProductIndex ? new UiProduct({ ...p, count: newCount }) : p
        );
      } else {
        const newUiProduct: UiProduct = new UiProduct({
          ...product,
          count: newCount,
        });
        updatedRemainingProducts = [...updatedRemainingProducts, newUiProduct];
      }

      const existingOrderDetail = state.step1State.orderDetails[existingOrderDetailIndex];
      const originalCount = existingOrderDetail.count - existingOrderDetail.remaining_count;
      const updatedOrderDetail = {
        ...existingOrderDetail,
        count: originalCount + newCount,
        remaining_count: newCount
      };

      const updatedOrderDetails = [...state.step1State.orderDetails];
      updatedOrderDetails[existingOrderDetailIndex] = updatedOrderDetail;

      const addedIndex = state.step1State.added.findIndex(orderDetail =>
        orderDetail.product.id === product.id
      );

      let updatedAdded = [...state.step1State.added];
      let updatedModified = [...state.step1State.modified];

      if (addedIndex !== -1) {

        updatedAdded = updatedAdded.map(item =>
          item.product.id === product.id ? updatedOrderDetail : item
        );
      } else {

        const modifiedIndex = state.step1State.modified.findIndex(
          item => item.product.id === product.id
        );

        if (modifiedIndex !== -1) {

          updatedModified = updatedModified.map(item =>
            item.product.id === product.id ? updatedOrderDetail : item
          );
        } else {

          updatedModified = [...updatedModified, updatedOrderDetail];
        }
      }

      return {
        ...state,
        step1State: {
          ...state.step1State,
          orderDetails: updatedOrderDetails,
          added: updatedAdded,
          modified: updatedModified
        },
        step2State: {
          ...state.step2State,
          remainingProducts: updatedRemainingProducts
        }
      };
    } else {

      const newOrderDetail = {
        id: Guid(),
        product,
        count: newCount,
        remaining_count: newCount,
        unit_price: 1
      };

      const newUiProduct: UiProduct = new UiProduct({
        ...product,
        count: newCount,
      });

      return {
        ...state,
        step1State: {
          ...state.step1State,
          orderDetails: [...state.step1State.orderDetails, newOrderDetail],
          added: [...state.step1State.added, newOrderDetail],
          modified: state.step1State.modified
        },
        step2State: {
          ...state.step2State,
          remainingProducts: [...state.step2State.remainingProducts, newUiProduct]
        }
      };
    }
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

  on(StepperActions.resetStep1State, (state) => ({
    ...state,
    step1State: {
      orderDetails: [],
      originalOrderDetails: [],
      added: [],
      modified: [],
      deleted: [],
      hasFile: false,
      fileName: undefined,
      isDirty: false,
      isOnlyOrderDirty: false
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
      isDirty: true,
      isOnlyOrderDirty: false
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
    const originalDetail = state.step1State.originalOrderDetails.find(item => item.id === orderDetail.id);

    // Use lodash's isEqual for a robust deep comparison.
    // If objects are identical, no need to update state or mark as dirty.

    const orderDetails = state.step1State.orderDetails.map(detail =>
      detail.id === orderDetail.id ? orderDetail : detail
    );

    const isOriginal = !!originalDetail;
    const isAlreadyModified = state.step1State.modified.some(item => item.id === orderDetail.id);

    let modified = [...state.step1State.modified];
    if (isOriginal && !isAlreadyModified && !isEqual(originalDetail, orderDetail)) {
      modified.push(orderDetail);
    } else if (isAlreadyModified) {
      modified = modified.map(item => item.id === orderDetail.id ? orderDetail : item);
    }

    const isDirty = modified.length > 0 || state.step1State.added.length > 0 || state.step1State.deleted.length > 0 ? true : false
    if (!isDirty) {
      return state;
    }
    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails,
        modified,
        isDirty,
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



);
//helper fn
const consolidateProducts = (products: UiProduct[]): UiProduct[] => {
  const consolidatedMap = new Map<string, UiProduct>();

  for (const product of products) {
    const existing = consolidatedMap.get(product.id);

    if (existing) {
      existing.count += product.count;
    } else {
      consolidatedMap.set(
        product.id,
        new UiProduct({
          ...product,
        })
      );
    }
  }

  return Array.from(consolidatedMap.values());
};


const ensureEmptyPackageAdded = (packages: any[], order: any): any => {
  const emptyPackage = new UiPackage({
    id: Guid(),
    pallet: null,
    products: [],
    order: order,
    name: `${packages.length + 1}`,
    isSavedInDb: false,
  });
  if (packages.filter(pkg => pkg.pallet == null || pkg.products.length === 0).length > 0)
    return ensurePackgesNamesOrdered(packages);
  return ensurePackgesNamesOrdered([...packages, emptyPackage]);
}


const ensurePackgesNamesOrdered = (packages: Partial<UiPackage>[]) => {
  return packages.map((pkg, index) => ({ ...pkg, name: `${index + 1}` }))
}
