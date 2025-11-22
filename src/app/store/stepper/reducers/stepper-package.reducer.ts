import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { PackageActions } from '../actions/package-detail.actions';
import { UiPackage } from '@features/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { UiProduct } from '@features/stepper/components/ui-models/ui-product.model';
import { mapPackageDetailToPackage } from '@features/mappers/package-detail.mapper';
import { calculatePackageChanges } from '@features/stepper/components/pallet-control/package-changes.helper';
import { mapUiPackagesToOrderDetails } from '@features/mappers/ui-package-to-order-detail.mapper';
import { OrderDetailDiffCalculator } from '@features/utils/order-detail-diff.util';
import { v4 as Guid } from 'uuid';

// Helper Functions
const consolidateProducts = (products: UiProduct[]): UiProduct[] => {
  const consolidatedMap = new Map<string, UiProduct>();

  for (const product of products) {
    const existing = consolidatedMap.get(product.id);

    if (existing) {
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
    return ensurePackagesNamesOrdered(packages);
  return ensurePackagesNamesOrdered([...packages, emptyPackage]);
};

const ensurePackagesNamesOrdered = (packages: Partial<UiPackage>[]) => {
  return packages.map((pkg, index) => ({ ...pkg, name: `${index + 1}` }));
};

export const stepperPackageHandlers = [
  // Set Vertical Sort
  on(StepperPackageActions.setVerticalSort, (state: StepperState, { verticalSort }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      verticalSort: verticalSort
    }
  })),

  on(StepperPackageActions.setVerticalSortInPackage, (state: StepperState, { pkgId, alignment }) => {
    const packages = state.step2State.packages.map(p => p.id === pkgId ? { ...p, alignment } : p)

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: packages,
      }
    }
  }),

  // Calculate Package Detail Success
  on(StepperPackageActions.calculatePackageDetailSuccess, (state: StepperState, { packages }) => {
    const remainingProducts: any[] = [];
    const order = state.order;
    if (!order) return state;

    const filteredPackages = packages.filter((pkg) => {
      const palletVolume =
        parseFloat(pkg.pallet?.dimension.width.toString() ?? '0') *
        parseFloat(pkg.pallet?.dimension.depth.toString() ?? '0') *
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
        addedPackages: ensureEmptyPackageAdded(filteredPackages, state.order),
        modifiedPackages: [],
        deletedPackageIds: [],
        remainingProducts: remainingProducts,
      }
    };
  }),

  // Get Pallets Success
  on(StepperPackageActions.getPalletsSuccess, (state: StepperState, { pallets }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      pallets: pallets
    }
  })),

  // Set Ui Packages
  on(StepperPackageActions.setUiPackages, (state: StepperState, { packages }) => {
    const isEditMode = state.isEditMode;
    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(packages, state.order),
        originalPackages: isEditMode ? ensureEmptyPackageAdded(packages, state.order) : state.step2State.originalPackages,
        addedPackages: [],
        modifiedPackages: [],
        deletedPackageIds: []
      }
    };
  }),

  // Set Remaining Products
  on(StepperPackageActions.setRemainingProducts, (state: StepperState, { remainingProducts }) => ({
    ...state,
    step2State: {
      ...state.step2State,
      remainingProducts: [...remainingProducts]
    }
  })),

  // Merge Remaining Products
  on(StepperPackageActions.mergeRemainingProducts, (state: StepperState) => {
    const currentProducts = state.step2State.remainingProducts;
    const mergedMap = new Map<string, UiProduct>();

    currentProducts.forEach(product => {
      const existing = mergedMap.get(product.id);

      if (existing) {
        mergedMap.set(product.id, new UiProduct({
          ...existing,
          count: existing.count + product.count
        }));
      } else {
        mergedMap.set(product.id, new UiProduct({ ...product }));
      }
    });

    const mergedProducts = Array.from(mergedMap.values());

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: mergedProducts,
      }
    };
  }),

  // Delete Remaining Product
  on(StepperPackageActions.deleteRemainingProduct, (state: StepperState, { productUiId }) => {
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

  // Add Ui Product To Remaining Products
  on(StepperPackageActions.addUiProductToRemainingProducts, (state: StepperState, { productUiId }) => {
    const product = state.step2State.packages.flatMap(p => p.products).find(p => p.ui_id === productUiId)
    if (!product) {
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
      }
    };
  }),

  // Remaining Product Move Product
  on(StepperPackageActions.remainingProductMoveProduct, (state: StepperState, { previousIndex, currentIndex }) => {
    const updatedRemainingProducts = [...state.step2State.remainingProducts];
    const [removed] = updatedRemainingProducts.splice(previousIndex, 1);
    updatedRemainingProducts.splice(currentIndex, 0, removed);

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts
      }
    };
  }),

  // Move Product To Remaining Products
  on(StepperPackageActions.moveProductToRemainingProducts, (state: StepperState, { uiProducts, previousIndex, previousContainerId }) => {
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

  // Move Remaining Product To Package
  on(StepperPackageActions.moveRemainingProductToPackage, (state: StepperState, { targetPackageId, previousIndex }) => {

    const sourceProducts = [...state.step2State.remainingProducts];
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId)
    if (!targetPackage) return state;
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


    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts: [...sourceProducts]
      }
    }
  }),

  // Move Partial Remaining Product To Package
  on(StepperPackageActions.movePartialRemainingProductToPackage, (state: StepperState, { targetPackageId, previousIndex, maxCount }) => {
     const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId);

    if (!targetPackage) {
      return state;
    }

    const sourceProducts = [...state.step2State.remainingProducts];
    const product = sourceProducts[previousIndex];

    if (!product) {
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

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts: sourceProducts

      }
    };
  }),

  // Move Pallet To Package
  on(StepperPackageActions.movePalletToPackage, (state: StepperState, {  containerId, previousIndex, previousContainerData }) => {
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

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: [...updatedPackages]
      }
    }
  }),

  // Remove Pallet From Package
  on(StepperPackageActions.removePalletFromPackage, (state: StepperState, { packageId }) => {
    const pkg = state.step2State.packages.find(p => p.id === packageId);
    if (!pkg || !pkg.pallet) return state;

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
    };
  }),

  // Move Ui Product In Same Package
  on(StepperPackageActions.moveUiProductInSamePackage, (state: StepperState, { packageId, previousIndex, currentIndex }) => {
    const currentPackages = state.step2State.packages;
    const targetPackageIndex = currentPackages.findIndex(pkg => pkg.id === packageId);

    if (targetPackageIndex !== -1) {
      const updatedPackages = [...currentPackages];
      const targetPackage = { ...updatedPackages[targetPackageIndex] };

      const updatedProducts = [...targetPackage.products];
      const [removed] = updatedProducts.splice(previousIndex, 1);
      updatedProducts.splice(currentIndex, 0, removed);

      const productsWithUpdatedPriority = updatedProducts.map((product: any, index: number) => ({
        ...product,
        priority: index
      }));

      targetPackage.products = productsWithUpdatedPriority;
      updatedPackages[targetPackageIndex] = targetPackage;

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

  // Move Ui Product In Package To Package
  on(StepperPackageActions.moveUiProductInPackageToPackage, (state: StepperState,  { sourcePackageId, targetPackageId, previousIndex }) => {

    if (sourcePackageId === targetPackageId) {
      return state;
    }
    const sourcePackage = state.step2State.packages.find(p => p.id === sourcePackageId)
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId)
    if (!sourcePackage || !targetPackage) return state;


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


    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: updatedPackages,
      }
    }
  }),

  // Move Partial Product Between Packages
  on(StepperPackageActions.movePartialProductBetweenPackages, (state: StepperState, { sourcePackageId, targetPackageId, previousIndex, maxCount }) => {

    // 1. Package'leri bul
    const sourcePackage = state.step2State.packages.find(p => p.id === sourcePackageId);
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId);

    // ✅ KRITIK: Null check
    if (!sourcePackage || !targetPackage) {
      return state;
    }

    // 2. Product array'lerini kopyala
    const sourceProducts = [...sourcePackage.products];
    const targetProducts = [...targetPackage.products];

    const product = sourceProducts[previousIndex];

    // ✅ KRITIK: Product check
    if (!product) {
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



    // 8. Yeni state döndür
    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),  // spread gereksiz
      }
    };
  }),

  // Remove Product From Package
  on(StepperPackageActions.removeProductFromPackage, (state: StepperState, { pkgId, productIndex }) => {
    const currentPackages = state.step2State.packages;
    const pkg = currentPackages.find(p => p.id === pkgId);

    if (!pkg) {
      return state;
    }

    const currentRemainingProducts = state.step2State.remainingProducts;
    const productToRemove = pkg.products[productIndex];

    if (!productToRemove) {
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
      }
    };
  }),

  // Remove Package
  on(StepperPackageActions.removePackage, (state: StepperState, { packageId }) => {
    const currentPackages = state.step2State.packages;
    const packageToDelete = currentPackages.find(p => p.id === packageId);

    if (!packageToDelete) return state;

    const updatedPackages = currentPackages.filter(p => p.id !== packageId);

    const remainingProducts = consolidateProducts(
      state.step2State.remainingProducts.concat(packageToDelete.products || [])
    );

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts,
      }
    };
  }),

  // Remove All Package
  on(StepperPackageActions.removeAllPackage, (state: StepperState) => {
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
      }
    };
  }),

  // Split Product
  on(StepperPackageActions.splitProduct, (state: StepperState, { productUiId, splitCount }) => {
    const product = state.step2State.remainingProducts.find(p => p.ui_id === productUiId);

    if (!product) {
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
        remainingProducts: remainingProducts
      }
    };
  }),

  // Update Product Count And Create Or Update Order Detail
  on(StepperPackageActions.updateProductCountAndCreateOrUpdateOrderDetail, (state: StepperState, { product, count }) => {
    const existingRemainingProductIndex = state.step2State.remainingProducts.findIndex(
      item => item.ui_id === product.ui_id
    );

    let updatedRemainingProducts = [...state.step2State.remainingProducts];

    if (existingRemainingProductIndex !== -1) {
      updatedRemainingProducts = updatedRemainingProducts.map((p, i) =>
        i === existingRemainingProductIndex ? { ...p, count: count } : { ...p }
      );
    } else {
      const newUiProduct: any = {
        ...product,
        ui_id: Guid(),
        count: count,
      };
      updatedRemainingProducts = [...updatedRemainingProducts, newUiProduct];
    }

    return {
      ...state,
      step1State: {
        ...state.step1State,
      },
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts
      }
    };
  }),

  // Pallet Control Submit
  on(StepperPackageActions.palletControlSubmit, (state: StepperState) => {
    let mergeOrderDetails;
    const mapperOrderDetails = mapUiPackagesToOrderDetails(state.step2State.packages);
    const changes = OrderDetailDiffCalculator.calculateDiff(
      mapperOrderDetails,
      state.step1State.originalOrderDetails,
      []
    );
    mergeOrderDetails = [...mapperOrderDetails];

    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails: mergeOrderDetails,
        added: changes.added.map(od => ({ ...od })),
        modified: changes.modified.map(od => ({ ...od })),
        deletedIds: [...changes.deletedIds],
      },
      step2State: {
        ...state.step2State,
        remainingProducts: []
      }
    };
  }),

  // Package Details Upsert Many Success
  on(PackageActions.upsertManySuccess, StepperPackageActions.createPackageDetailsSuccess, (state: StepperState, { packageDetails }) => {
    const uiPackages = mapPackageDetailToPackage(packageDetails);
    return {
      ...state,
      completedStep: 2,
      step2State: {
        ...state.step2State,
        packages: uiPackages,
        originalPackages: uiPackages,
        addedPackages: [],
        modifiedPackages: [],
        deletedPackageIds: [],
        isDirty: false
      }
    };
  }),

  // Calculate Package Changes
  on(StepperPackageActions.calculatePackageChanges, (state: StepperState) => {
    console.log('[Reducer] calculatePackageChanges - Başlatılıyor');

    const packages = state.step2State.packages.map(
      (pkg: any) => new UiPackage({ ...pkg })
    );
    const originalPackages = state.step2State.originalPackages.map(
      (pkg: any) => new UiPackage({ ...pkg })
    );

    console.log('[Reducer] calculatePackageChanges - Paket sayıları:', {
      packagesCount: packages.length,
      originalPackagesCount: originalPackages.length
    });

    const changes = calculatePackageChanges(packages, originalPackages);
    const isDirty = originalPackages.length === 0
      ? false
      : (changes.added.length > 0 ||
        changes.modified.length > 0 ||
        changes.deletedIds.length > 0);

    console.log('[Reducer] calculatePackageChanges - Changes hesaplandı:', {
      addedCount: changes.added.length,
      modifiedCount: changes.modified.length,
      deletedCount: changes.deletedIds.length
    });

    return {
      ...state,
      step2State: {
        ...state.step2State,
        addedPackages: changes.added,
        modifiedPackages: changes.modified,
        deletedPackageIds: changes.deletedIds,
        isDirty: isDirty
      }
    };
  }),
];
