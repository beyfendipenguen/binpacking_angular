import { createReducer, on } from '@ngrx/store';
import { initialStepperState } from './stepper.state';
import * as StepperActions from './stepper.actions';
import { mapPackageDetailToPackage } from '../../models/mappers/package-detail.mapper';
import { UiPackage } from '../../admin/components/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '../../admin/components/stepper/components/ui-models/ui-pallet.model';
import { UiProduct } from '../../admin/components/stepper/components/ui-models/ui-product.model';
import { isEqual } from 'lodash-es';
import { OrderDetailDiffCalculator } from '../../models/utils/order-detail-diff.util';
import { mapUiPackagesToOrderDetails, mapUiProductsToOrderDetails } from '../../models/mappers/ui-package-to-order-detail.mapper';
import { v4 as Guid } from 'uuid';

export const stepperReducer = createReducer(
  initialStepperState,
  on(StepperActions.setOrderDetails, (state, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      isOrderDetailsDirty: false
    }
  })),

  on(StepperActions.calculateOrderDetailChanges, (state) => {
    let mergeOrderDetails;
    const mapperOrderDetails = mapUiPackagesToOrderDetails(state.step2State.packages)
    const changes = OrderDetailDiffCalculator.calculateDiff(
      mapperOrderDetails,
      state.step1State.originalOrderDetails,
      state.step2State.remainingProducts
    )
    if (state.step2State.remainingProducts.length > 0) {
      const remainingOrderDetails = mapUiProductsToOrderDetails(state.step2State.remainingProducts, state.order)
      mergeOrderDetails = [...mapperOrderDetails, ...remainingOrderDetails]
    }
    else {
      mergeOrderDetails = [...mapperOrderDetails]
    }

    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails: mergeOrderDetails,
        ...changes
      }
    }
  }),

  on(StepperActions.deleteRemainingProduct, (state, { productUiId }) => {

    const remainingProducts = state.step2State.remainingProducts;
    const updatedRemainingProducts = remainingProducts.filter(p => p.ui_id !== productUiId);

    return {
      ...state,
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

  on(StepperActions.updateOrderResult, (state, { orderResult }) => (
    {
      ...state,
      step3State: {
        ...state.step3State,
        orderResult: orderResult
      }
    }
  )),

  on(StepperActions.completeShipment, (state, { orderResult }) => (
    {
      ...state,
      step3State: {
        ...state.step3State,
        orderResult: orderResult
      }
    }
  )),

  on(StepperActions.addUiProductToRemainingProducts, (state, { productUiId }) => {
    const product = state.step2State.packages.flatMap(p => p.products).find(p => p.ui_id === productUiId)
    if (!product) {
      console.error('❌ Product bulunamadı');
      return state;
    }

    const remainingProducts = state.step2State.remainingProducts;
    const alreadyExists = remainingProducts.some(p => p.ui_id === product.ui_id);

    if (alreadyExists) {
      return state;
    }

    const newProduct = {
      ...product,
      count: 1,
    };

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: [...remainingProducts, newProduct],
        isDirty: true
      }
    };
  }),

  on(StepperActions.setVerticalSort, (state, { verticalSort }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      verticalSort: verticalSort
    }
  })),

  on(StepperActions.setVerticalSortInPackage, (state, { pkgId, alignment }) => {
    const packages = state.step2State.packages.map(p => p.id === pkgId ? { ...p, alignment } : p)

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: packages,
        isDirty: true
      }
    }
  }),

  on(StepperActions.setStepperData, (state, { data }) => ({
    ...state,
    ...data
  })),


  on(StepperActions.setStep2IsDirty, (state) => {

    if (state.step2State.isDirty) {
      return state
    }
    return {
      ...state,
      step2State: {
        ...state.step2State,
        isDirty: true
      }
    }
  }),

  on(StepperActions.setStep3IsDirty, (state) => {

    if (state.step3State.isDirty) {
      return state
    }
    return {
      ...state,
      step3State: {
        ...state.step3State,
        isDirty: true
      }
    }
  }),



  on(StepperActions.calculatePackageDetailSuccess, (state, { packages }) => {
    const remainingProducts: any[] = [];
    const order = state.order;
    if (!order) return state;

    const filteredPackages = packages.filter((pkg) => {
      const palletVolume =
        parseFloat(pkg.pallet.dimension.width) *
        parseFloat(pkg.pallet.dimension.depth) *
        parseFloat(order.max_pallet_height.toString() ?? '0');

      const productsVolume = pkg.products.reduce((sum: number, product: any) => {
        const productVolume =
          parseFloat(product.dimension.width) *
          parseFloat(product.dimension.height) *
          parseFloat(product.dimension.depth) *
          product.count;
        return sum + productVolume;
      }, 0);

      const fillRate = (productsVolume / palletVolume) * 100;

      if (fillRate < 30) {
        remainingProducts.push(...pkg.products);
        return false;
      }

      return true;
    });

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(filteredPackages, state.order),
        originalPackages: [...packages],
        remainingProducts: remainingProducts,
        isDirty: true
      }
    };
  }),

  on(StepperActions.removePalletFromPackage, (state, { pkgId }) => {

    const pkg = state.step2State.packages.find(p => p.id === pkgId)
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
      pkg.pallet && pkg.pallet.ui_id === previousContainerId
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

  on(StepperActions.createReportFileSuccess, (state, { reportFiles }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      reportFiles: reportFiles,
      isDirty: false
    }
  })),

  on(StepperActions.resultStepSubmit, (state, { orderResult, resetStepper, packageNames }) => {
    const currentPackages = state.step2State.packages;
    let packagesToKeep = [...currentPackages];
    if (!!packageNames && packageNames.length > 0) {
      packagesToKeep = currentPackages.filter(
        (pkg) => !packageNames.some((packageName) => packageName == pkg.name)
      );
    }
    let mergeOrderDetails;
    const mapperOrderDetails = mapUiPackagesToOrderDetails(packagesToKeep)
    const changes = OrderDetailDiffCalculator.calculateDiff(
      mapperOrderDetails,
      state.step1State.originalOrderDetails,
      []
    )
    mergeOrderDetails = [...mapperOrderDetails]


    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails: mergeOrderDetails,
        ...changes,
      },
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(packagesToKeep, state.order),
        isDirty: true,
      },
      step3State: {
        ...state.step3State,
        orderResult: orderResult,
        isDirty: false,
        hasResults: true,
      }

    };
  }),

  on(StepperActions.createOrderDetailsSuccess, (state, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      added: [],
      deleted: [],
      modified: [],
      isOrderDetailsDirty: false,
    }
  })),

  on(StepperActions.updateOrderDetailsChangesSuccess, (state, { orderDetails, context }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      added: [],
      deleted: [],
      modified: [],
    }
  })),

  on(StepperActions.setOrder, (state, { order, context }) => {
    return {
      ...state,
      order: { ...order },
      step1State: {
        ...state.step1State,
      }
    }
  }),

  on(StepperActions.updateOrCreateOrderSuccess, (state, { order }) => ({
    ...state,
    order: order,
    originalOrder: order,
    step1State: {
      ...state.step1State,
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

  on(StepperActions.moveRemainingProductToPackage, (state, { targetPackageId, previousIndex }) => {

    const sourceProducts = [...state.step2State.remainingProducts];
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId)
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
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
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

    const palletClone = new UiPallet({
      ...originalPallet
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

  on(StepperActions.removeProductFromPackage, (state, { pkgId, productIndex }) => {
    const currentPackages = state.step2State.packages;
    const pkg = currentPackages.find(p => p.id === pkgId);

    if (!pkg) {
      console.error('❌ Package bulunamadı', { pkgId });
      return state;
    }

    const currentRemainingProducts = state.step2State.remainingProducts;
    const productToRemove = pkg.products[productIndex];

    if (!productToRemove) {
      console.error('❌ Product bulunamadı', { productIndex });
      return state;
    }

    const updatedPackageProducts = [...pkg.products];
    const removedProduct = updatedPackageProducts.splice(productIndex, 1)[0];

    const updatedPackage = { ...pkg, products: updatedPackageProducts };
    const updatedPackages = currentPackages.map(p =>
      p.id === pkgId ? updatedPackage : { ...p }
    );

    const updatedRemainingProducts = [...currentRemainingProducts, { ...removedProduct }];

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: updatedPackages,
        remainingProducts: updatedRemainingProducts,
        isDirty: true
      }
    };
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

  on(StepperActions.removePackage, (state, { packageId }) => {
    const currentPackages = state.step2State.packages;
    const packageToDelete = currentPackages.find(p => p.id === packageId);

    if (!packageToDelete) {
      return state;
    }

    const updatedPackages = currentPackages.filter(p => p.id !== packageId);

    const remainingProducts = consolidateProducts(
      state.step2State.remainingProducts
        .concat(packageToDelete.products || [])
    );
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
    fileExists: true
  })),

  on(StepperActions.uploadFileToOrderSuccess, (state) => ({
    ...state,
    fileExists: false
  })),


  on(StepperActions.mergeRemainingProducts, (state) => {
    const currentProducts = state.step2State.remainingProducts;

    // Aynı id'ye sahip ürünleri grupla ve count'larını birleştir
    const mergedMap = new Map<string, UiProduct>();

    currentProducts.forEach(product => {
      const existing = mergedMap.get(product.id);

      if (existing) {
        // Aynı id'li ürün varsa, count'ları topla
        mergedMap.set(product.id, new UiProduct({
          ...existing,
          count: existing.count + product.count
        }));
      } else {
        // İlk defa görüyoruz, direkt ekle
        mergedMap.set(product.id, new UiProduct({ ...product }));
      }
    });

    // Map'ten array'e çevir
    const mergedProducts = Array.from(mergedMap.values());

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: mergedProducts,
        // isDirty: true //TODO: burada isdirty yapilir mi bilemedim.
      }
    };
  }),

  on(StepperActions.splitProduct, (state, { productUiId, splitCount }) => {
    const product = state.step2State.remainingProducts.find(p => p.ui_id === productUiId);

    if (!product) {
      console.error('❌ Product bulunamadı', { productUiId });
      return state;
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

    const originalIndex = currentProducts.findIndex(p => p.ui_id === productUiId);

    if (originalIndex === -1) {
      return state;
    }

    let remainingProducts: any[];

    if (isCustomSplit) {
      const firstPart = {
        ...product,
        ui_id: Guid(),
        count: validatedCount,
      };

      const secondPart = {
        ...product,
        ui_id: Guid(),
        count: product.count - validatedCount,
      };

      remainingProducts = [...currentProducts];
      remainingProducts.splice(originalIndex, 1, firstPart, secondPart);
    } else {
      const firstHalf = {
        ...product,
        ui_id: Guid(),
        count: validatedCount,
      };

      const secondHalf = {
        ...product,
        ui_id: Guid(),
        count: product.count - validatedCount,
      };

      remainingProducts = [...currentProducts];
      remainingProducts.splice(originalIndex, 1, firstHalf, secondHalf);
    }

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: remainingProducts,
        isDirty: true
      }
    };
  }),

  on(StepperActions.movePartialRemainingProductToPackage, (state, { targetPackageId, previousIndex, maxCount }) => {
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId);

    if (!targetPackage) {
      console.error('❌ Target package bulunamadı', { targetPackageId });
      return state;
    }

    const sourceProducts = [...state.step2State.remainingProducts];
    const product = sourceProducts[previousIndex];

    if (!product) {
      console.error('❌ Product bulunamadı', { previousIndex });
      return state;
    }

    const targetProducts = [...targetPackage.products];
    const remainingCount = product.count - maxCount;

    if (remainingCount > 0) {
      sourceProducts[previousIndex] = {
        ...product,
        count: remainingCount
      };
    } else {
      sourceProducts.splice(previousIndex, 1);
    }

    const existingProductIndex = targetProducts.findIndex(p => p.id === product.id);

    if (existingProductIndex !== -1) {
      targetProducts[existingProductIndex] = {
        ...targetProducts[existingProductIndex],
        count: targetProducts[existingProductIndex].count + maxCount
      };
    } else {
      targetProducts.push({
        ...product,
        count: maxCount
      });
    }

    const updatedPackage = { ...targetPackage, products: targetProducts };
    const updatedPackages = state.step2State.packages.map(pkg =>
      pkg.id === targetPackageId ? updatedPackage : { ...pkg }
    );

    const isOriginal = state.step2State.originalPackages.some(item => item.id === targetPackageId);
    const isAlreadyModified = state.step2State.modifiedPackages.some(item => item.id === targetPackageId);

    let modified = [...state.step2State.modifiedPackages];
    if (isOriginal && !isAlreadyModified) {
      modified.push(updatedPackage);
    } else if (isAlreadyModified) {
      modified = modified.map(item => item.id === targetPackageId ? updatedPackage : item);
    }

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts: sourceProducts,
        modifiedPackages: modified,
        isDirty: true
      }
    };
  }),

  on(StepperActions.movePartialProductBetweenPackages, (state, { sourcePackageId, targetPackageId, previousIndex, maxCount }) => {

    // 1. Package'leri bul
    const sourcePackage = state.step2State.packages.find(p => p.id === sourcePackageId);
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId);

    // ✅ KRITIK: Null check
    if (!sourcePackage || !targetPackage) {
      console.error('❌ Package bulunamadı', { sourcePackageId, targetPackageId });
      return state;
    }

    // 2. Product array'lerini kopyala
    const sourceProducts = [...sourcePackage.products];
    const targetProducts = [...targetPackage.products];

    const product = sourceProducts[previousIndex];

    // ✅ KRITIK: Product check
    if (!product) {
      console.error('❌ Product bulunamadı', { previousIndex });
      return state;
    }

    // 3. Source'dan azalt
    const remainingCount = product.count - maxCount;

    if (remainingCount > 0) {
      // ✅ Plain object kullan
      sourceProducts[previousIndex] = {
        ...product,
        count: remainingCount
      };
    } else {
      sourceProducts.splice(previousIndex, 1);
    }

    // 4. Target'a ekle
    const existingProductIndex = targetProducts.findIndex(p => p.id === product.id);

    if (existingProductIndex !== -1) {
      // ✅ Plain object kullan
      targetProducts[existingProductIndex] = {
        ...targetProducts[existingProductIndex],
        count: targetProducts[existingProductIndex].count + maxCount
      };
    } else {
      // ✅ Plain object kullan
      targetProducts.push({
        ...product,
        count: maxCount
      });
    }

    // 5. Package'leri güncelle - ✅ Plain object
    const updatedSourcePackage = {
      ...sourcePackage,
      products: sourceProducts
    };
    const updatedTargetPackage = {
      ...targetPackage,
      products: targetProducts
    };

    // 6. Tüm packages array'ini güncelle - ✅ Her şeyi kopyala
    const updatedPackages = state.step2State.packages.map(pkg => {
      if (pkg.id === sourcePackageId) return updatedSourcePackage;
      if (pkg.id === targetPackageId) return updatedTargetPackage;
      return { ...pkg };  // ✅ Diğer package'leri de kopyala
    });

    // 7. Modified packages'i güncelle
    let modified = [...state.step2State.modifiedPackages];

    // Source package için
    const isSourceOriginal = state.step2State.originalPackages.some(item => item.id === sourcePackageId);
    const isSourceAlreadyModified = modified.some(item => item.id === sourcePackageId);

    if (isSourceOriginal && !isSourceAlreadyModified) {
      modified.push(updatedSourcePackage);
    } else if (isSourceAlreadyModified) {
      modified = modified.map(item => item.id === sourcePackageId ? updatedSourcePackage : item);
    }

    // Target package için
    const isTargetOriginal = state.step2State.originalPackages.some(item => item.id === targetPackageId);
    const isTargetAlreadyModified = modified.some(item => item.id === targetPackageId);

    if (isTargetOriginal && !isTargetAlreadyModified) {
      modified.push(updatedTargetPackage);
    } else if (isTargetAlreadyModified) {
      modified = modified.map(item => item.id === targetPackageId ? updatedTargetPackage : item);
    }

    // 8. Yeni state döndür
    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),  // spread gereksiz
        modifiedPackages: modified,  // spread gereksiz (zaten yeni array)
        isDirty: true
      }
    };
  }),

  on(StepperActions.moveUiProductInPackageToPackage, (state, { sourcePackageId, targetPackageId, previousIndex }) => {

    if (sourcePackageId === targetPackageId) {
      return state;
    }
    const sourcePackage = state.step2State.packages.find(p => p.id === sourcePackageId)
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId)

    const sourceProducts = [...sourcePackage.products];
    let targetProducts = [...targetPackage.products];
    const [removedProduct] = sourceProducts.splice(previousIndex, 1);

    targetProducts = targetProducts.map(p => p.id === removedProduct.id ? new UiProduct({ ...p, count: p.count + removedProduct.count }) : new UiProduct({ ...p }))

    if (targetProducts.findIndex(p => p.id === removedProduct.id) === -1)
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
      pkg.pallet && pkg.pallet.ui_id === containerId
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

    const existingRemainingProductIndex = state.step2State.remainingProducts.findIndex(
      item => item.ui_id === product.ui_id
    );

    let updatedRemainingProducts = [...state.step2State.remainingProducts];

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

    return {
      ...state,
      step1State: {
        ...state.step1State,
        isOrderDetailsDirty: true
      },
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts
      }
    };
  }),

  on(StepperActions.navigateToStep, (state, { stepIndex }) => ({
    ...state,
    currentStep: stepIndex,
    error: null
  })),

  on(StepperActions.setStepCompleted, (state, { stepIndex }) => ({
    ...state,
    completedStep: Math.max(state.completedStep, stepIndex)
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

  on(StepperActions.setTemplateFile, (state, { templateFile }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      templateFile: templateFile
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
      templateFile: []
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
      templateFile: []
    }
  })),

  on(StepperActions.addOrderDetail, (state, { orderDetail }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...state.step1State.orderDetails, orderDetail],
      added: [...state.step1State.added, orderDetail],
    }
  })),

  on(StepperActions.updateOrderDetail, (state, { orderDetail }) => {
    const originalDetail = state.step1State.originalOrderDetails.find(item => item.id === orderDetail.id);

    const orderDetails = state.step1State.orderDetails.map(detail =>
      detail.id === orderDetail.id ? orderDetail : detail
    );
    const added = state.step1State.added.map(detail =>
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
        added,
        orderDetails,
        modified,
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
        isOrderDetailsDirty: true
      }
    };
  }),


  on(StepperActions.getPalletsSuccess, (state, { pallets }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      pallets: pallets
    }
  }))

);
//helper fn
const consolidateProductsEski = (products: UiProduct[]): UiProduct[] => {
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

const consolidateProducts = (products: UiProduct[]): UiProduct[] => {
  const consolidatedMap = new Map<string, UiProduct>();

  for (const product of products) {
    const existing = consolidatedMap.get(product.id);

    if (existing) {
      // ✅ Yeni obje oluştur, mevcut objeyi değiştirme!
      consolidatedMap.set(
        product.id,
        new UiProduct({
          ...existing,
          count: existing.count + product.count
        })
      );
    } else {
      consolidatedMap.set(product.id, new UiProduct({ ...product }));
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
  if (packages.some(pkg => pkg.pallet === null || pkg.products.length === 0))
    return ensurePackgesNamesOrdered(packages);
  return ensurePackgesNamesOrdered([...packages, emptyPackage]);
}


const ensurePackgesNamesOrdered = (packages: Partial<UiPackage>[]) => {
  return packages.map((pkg, index) => ({ ...pkg, name: `${index + 1}` }))
}
