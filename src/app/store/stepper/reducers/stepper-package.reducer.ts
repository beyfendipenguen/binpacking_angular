import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { UiPackage } from '@features/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { calculatePackageChanges } from '@features/stepper/components/pallet-control/package-changes.helper';
import { mapUiPackagesToOrderDetails } from '@features/mappers/ui-package-to-order-detail.mapper';
import { OrderDetailDiffCalculator } from '@features/utils/order-detail-diff.util';
import { v4 as Guid } from 'uuid';
import { PackageDetailReadDto } from '@app/features/interfaces/package-detail.interface';
import { toInteger } from 'lodash';
import { mapPackageReadDtoListToIUiPackageList } from '@app/features/mappers/package.mapper';
import { IUiPackage } from '@app/features/stepper/interfaces/ui-interfaces/ui-package.interface';

// Helper Functions
const consolidatePackageDetails = (packageDetails: PackageDetailReadDto[]): PackageDetailReadDto[] => {
  const consolidatedMap = new Map<string, PackageDetailReadDto>();

  for (const packageDetail of packageDetails) {
    const existing = consolidatedMap.get(packageDetail.id);

    if (existing) {
      consolidatedMap.set(
        packageDetail.id,
        {
          ...existing,
          count: existing.count + packageDetail.count
        }
      );
    } else {
      consolidatedMap.set(packageDetail.id, { ...packageDetail });
    }
  }
  return Array.from(consolidatedMap.values());
};

const createEmptyPackage = (packageNo: number, order: any) => (
  {
    id: Guid(),
    order_id: order.id,
    name: `${packageNo}`,
    pallet: null,
    height: 2400,
    package_details: [],
    is_remaining: true,
    alignment: "h"
  }
)

const ensureEmptyPackageAdded = (packages: IUiPackage[], order: any): any => {
  if (packages.some(pkg => pkg.pallet === null || pkg.package_details.length === 0))
    return packages;
  return [...packages, createEmptyPackage(packages.length + 1, order)];
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

  on(StepperPackageActions.calculateOrderDetailChanges, (state: StepperState) => {
    const mapperOrderDetails = mapUiPackagesToOrderDetails(state.step2State.packages);
    const changes = OrderDetailDiffCalculator.calculateDiff(
      mapperOrderDetails,
      state.step1State.originalOrderDetails
    );

    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails: [...mapperOrderDetails],
        added: changes.added.map(od => ({ ...od })),
        modified: changes.modified.map(od => ({ ...od })),
        deletedIds: [...changes.deletedIds],
      }
    };
  }),

  // Calculate Package Detail Success
  on(StepperPackageActions.calculatePackageDetailSuccess, (state: StepperState, { packages }) => {
    const { order } = state;
    if (!order) return state;

    let remainingProducts: any[] = [];

    const uiPackages = mapPackageReadDtoListToIUiPackageList(packages);

    const filteredPackages = uiPackages.filter((pkg) => {
      const palletVolume =
        parseFloat(pkg.pallet?.dimension.width.toString() ?? '0') *
        parseFloat(pkg.pallet?.dimension.depth.toString() ?? '0') *
        parseFloat(order.max_pallet_height.toString() ?? '0');

      const productsVolume = pkg.package_details.reduce((sum: number, packageDetail: PackageDetailReadDto) => {
        const productVolume =
          packageDetail.product.dimension.width *
          packageDetail.product.dimension.height *
          packageDetail.product.dimension.depth *
          packageDetail.count;
        return sum + productVolume;
      }, 0);

      const fillRate = (productsVolume / palletVolume) * 100;

      if (fillRate < 30) {
        remainingProducts.push(...pkg.package_details);
        return false;
      }

      return true;
    });

    const sortedPackages = [...filteredPackages].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(sortedPackages, state.order),
        originalPackages: packages,
        addedPackages: [],
        modifiedPackages: [],
        deletedPackageIds: [],
        remainingProducts: remainingProducts,
      }
    };
  }),

  //add pallets
  on(StepperPackageActions.addPalletToAvailable, (state: StepperState, { pallet }) => {
    const exists = state.step2State.pallets.some(p => p.id === pallet.id);

    if (exists) {
      return state;
    }

    return {
      ...state,
      step2State: {
        ...state.step2State,
        pallets: [pallet, ...state.step2State.pallets]
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
    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(packages, state.order),
        originalPackages: state.step2State.originalPackages,
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
    const currentPackageDetails = state.step2State.remainingProducts;
    const mergedMap = new Map<string, PackageDetailReadDto>();

    currentPackageDetails.forEach(packageDetail => {
      const existing = mergedMap.get(packageDetail.product.id);

      if (existing) {
        mergedMap.set(packageDetail.product.id, {
          ...existing,
          count: existing.count + packageDetail.count
        });
      } else {
        mergedMap.set(packageDetail.product.id, { ...packageDetail });
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
  on(StepperPackageActions.deleteRemainingProducts, (state: StepperState, { packageDetailIds }) => {
    const remainingProducts = state.step2State.remainingProducts;
    const updatedRemainingProducts = remainingProducts.filter(pd => !packageDetailIds.includes(pd.id));

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: updatedRemainingProducts
      }
    };
  }),

  // Add Ui Product To Remaining Products
  on(StepperPackageActions.addPackageDetailToRemainingProducts, (state: StepperState, { packageDetailId }) => {

    let targetPackageDetail: PackageDetailReadDto | undefined;
    let targetPackage: any;

    for (const pkg of state.step2State.packages) {
      const found = pkg.package_details.find(pd => pd.id === packageDetailId);
      if (found) {
        targetPackageDetail = found;
        targetPackage = pkg;
        break;
      }
    }

    if (!targetPackageDetail || !targetPackage) {
      return state;
    }


    const tempPackageDetails = targetPackage.package_details.map((pd: PackageDetailReadDto) =>
      pd.id === packageDetailId
        ? { ...pd, count: pd.count + 1 }
        : pd
    );

    const fillPercentage = getPalletFillPercentage(
      targetPackage.pallet,
      tempPackageDetails
    );

    if (fillPercentage <= 100) {
      return {
        ...state,
        step2State: {
          ...state.step2State,
          packages: state.step2State.packages.map(pkg =>
            pkg.id === targetPackage.id
              ? {
                ...pkg,
                package_details: tempPackageDetails
              }
              : pkg
          )
        }
      };
    }

    const remainingProducts = state.step2State.remainingProducts;
    const alreadyExists = remainingProducts.some(pd => pd.product.id === targetPackageDetail.product.id);

    if (alreadyExists) {
      return state;
    }

    const newPackageDetail = {
      ...targetPackageDetail,
      count: 1,
    };

    return {
      ...state,
      step2State: {
        ...state.step2State,
        remainingProducts: [...remainingProducts, newPackageDetail],
      }
    };
  }),

  on(StepperPackageActions.reducePackageDetailCount, (state: StepperState, { packageDetailId }) => {

    let targetPackageDetail: PackageDetailReadDto | undefined;
    let targetPackage: any;

    for (const pkg of state.step2State.packages) {
      const found = pkg.package_details.find(pd => pd.id === packageDetailId);
      if (found) {
        targetPackageDetail = found;
        targetPackage = pkg;
        break;
      }
    }

    if (!targetPackageDetail || !targetPackage) {
      return state;
    }

    if (targetPackageDetail.count <= 1) {
      return state;
    }

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: state.step2State.packages.map(pkg =>
          pkg.id === targetPackage.id
            ? {
              ...pkg,
              package_details: pkg.package_details.map(pd =>
                pd.id === packageDetailId
                  ? { ...pd, count: pd.count - 1 }
                  : pd
              )
            }
            : pkg
        )
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
  on(StepperPackageActions.movePackageDetailToRemainingProducts, (state: StepperState, { packageDetails, previousIndex, previousContainerId }) => {
    const sourcePackageDetails = [...packageDetails];
    const removedPackageDetail = sourcePackageDetails.splice(previousIndex, 1)[0];

    const currentRemainingProducts = state.step2State.remainingProducts; // Store'dan mevcut array'i al
    const updatedRemainingProducts = [...currentRemainingProducts, removedPackageDetail];

    const currentPackages = state.step2State.packages;
    const sourcePackage = currentPackages.find(pkg =>
      pkg.pallet && pkg.pallet.ui_id === previousContainerId
    );

    if (sourcePackage) {
      const updatedPackages = currentPackages.map(pkg =>
        pkg.id === sourcePackage.id ? new UiPackage({ ...pkg, package_details: sourcePackageDetails }) : pkg
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

    const sourcePackageDetails = [...state.step2State.remainingProducts];
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId)
    if (!targetPackage) return state;
    const targetPackageDetails = [...targetPackage.package_details];

    const removedProduct = sourcePackageDetails.splice(previousIndex, 1)[0];

    const existingProductIndex = targetPackageDetails.findIndex(p =>
      p.product.id === removedProduct.product.id
    );

    if (existingProductIndex !== -1) {
      targetPackageDetails[existingProductIndex] = {
        ...targetPackageDetails[existingProductIndex],
        count: targetPackageDetails[existingProductIndex].count + removedProduct.count
      };
    } else {
      targetPackageDetails.push({
        ...removedProduct,
        id: Guid()
      });
    }

    const updatedPackage = { ...targetPackage, package_details: targetPackageDetails };
    const updatedPackages = state.step2State.packages.map(pkg =>
      pkg.id === updatedPackage.id ? updatedPackage : pkg
    ) as UiPackage[];


    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts: [...sourcePackageDetails]
      }
    }
  }),

  // Move Partial Remaining Product To Package
  on(StepperPackageActions.movePartialRemainingProductToPackage, (state: StepperState, { targetPackageId, previousIndex, maxCount }) => {
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId);

    if (!targetPackage) {
      return state;
    }

    const sourcePackageDetails = [...state.step2State.remainingProducts];
    const packageDetail = sourcePackageDetails[previousIndex];

    if (!packageDetail) {
      return state;
    }

    const targetPackageDetails = [...targetPackage.package_details];
    const remainingCount = packageDetail.count - maxCount;

    if (remainingCount > 0) {
      sourcePackageDetails[previousIndex] = {
        ...packageDetail,
        count: remainingCount
      };
    } else {
      sourcePackageDetails.splice(previousIndex, 1);
    }

    const existingPackageDetailIndex = targetPackageDetails.findIndex(p => p.product.id === packageDetail.product.id);

    if (existingPackageDetailIndex !== -1) {
      targetPackageDetails[existingPackageDetailIndex] = {
        ...targetPackageDetails[existingPackageDetailIndex],
        count: targetPackageDetails[existingPackageDetailIndex].count + maxCount
      };
    } else {
      targetPackageDetails.push({
        ...packageDetail,
        count: maxCount,
        id: Guid()
      });
    }

    const updatedPackage = { ...targetPackage, package_details: targetPackageDetails };
    const updatedPackages = state.step2State.packages.map(pkg =>
      pkg.id === targetPackageId ? updatedPackage : { ...pkg }
    );

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: ensureEmptyPackageAdded(updatedPackages, state.order),
        remainingProducts: sourcePackageDetails

      }
    };
  }),

  // Move Pallet To Package
  on(StepperPackageActions.movePalletToPackage, (state: StepperState, { containerId, previousIndex, previousContainerData }) => {
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
    if (pkg.package_details?.length > 0) {
      const packageDetails = pkg.package_details;
      const currentRemainingProducts = state.step2State.remainingProducts;
      updatedRemainingProducts = [...currentRemainingProducts, ...packageDetails];
    }

    const currentPackages = state.step2State.packages;
    const updatedPackages = currentPackages.map(uiPackage =>
      uiPackage.id === pkg.id ? { ...pkg, pallet: null, package_details: [] } : uiPackage
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
  on(StepperPackageActions.movePackageDetailInSamePackage, (state: StepperState, { packageId, previousIndex, currentIndex }) => {
    const currentPackages = state.step2State.packages;
    const targetPackageIndex = currentPackages.findIndex(pkg => pkg.id === packageId);

    if (targetPackageIndex !== -1) {
      const updatedPackages = [...currentPackages];
      const targetPackage = { ...updatedPackages[targetPackageIndex] };

      const updatedPackageDetails = [...targetPackage.package_details];
      const [removed] = updatedPackageDetails.splice(previousIndex, 1);
      updatedPackageDetails.splice(currentIndex, 0, removed);

      const packageDetailsWithUpdatedPriority = updatedPackageDetails.map((packageDetail: PackageDetailReadDto, index: number) => ({
        ...packageDetail,
        priority: index
      }));

      targetPackage.package_details = packageDetailsWithUpdatedPriority;
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
  on(StepperPackageActions.movePackageDetailInPackageToPackage, (state: StepperState, { sourcePackageId, targetPackageId, previousIndex }) => {

    if (sourcePackageId === targetPackageId) {
      return state;
    }
    const sourcePackage = state.step2State.packages.find(p => p.id === sourcePackageId)
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId)
    if (!sourcePackage || !targetPackage) return state;


    const sourcePackageDetails = [...sourcePackage.package_details];
    let targetPackageDetails = [...targetPackage.package_details];
    const [removedPackageDetail] = sourcePackageDetails.splice(previousIndex, 1);

    targetPackageDetails = targetPackageDetails.map(pd => pd.product.id === removedPackageDetail.product.id ? { ...pd, count: pd.count + removedPackageDetail.count } : { ...pd })

    if (targetPackageDetails.findIndex(p => p.product.id === removedPackageDetail.product.id) === -1)
      targetPackageDetails.push(removedPackageDetail);

    const updatedSourcePackage = { ...sourcePackage, package_details: sourcePackageDetails };
    const updatedTargetPackage = { ...targetPackage, package_details: targetPackageDetails };

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
  on(StepperPackageActions.movePartialPackageDetailBetweenPackages, (state: StepperState, { sourcePackageId, targetPackageId, previousIndex, maxCount }) => {

    // 1. Package'leri bul
    const sourcePackage = state.step2State.packages.find(p => p.id === sourcePackageId);
    const targetPackage = state.step2State.packages.find(p => p.id === targetPackageId);

    // ✅ KRITIK: Null check
    if (!sourcePackage || !targetPackage) {
      return state;
    }

    // 2. Product array'lerini kopyala
    const sourcePackageDetails = [...sourcePackage.package_details];
    const targetPackageDetails = [...targetPackage.package_details];

    const packageDetail = sourcePackageDetails[previousIndex];

    // ✅ KRITIK: Product check
    if (!packageDetail) {
      return state;
    }

    // 3. Source'dan azalt
    const remainingCount = packageDetail.count - maxCount;

    if (remainingCount > 0) {
      // ✅ Plain object kullan
      sourcePackageDetails[previousIndex] = {
        ...packageDetail,
        count: remainingCount
      };
    } else {
      sourcePackageDetails.splice(previousIndex, 1);
    }

    // 4. Target'a ekle
    const existingPackageDetailIndex = targetPackageDetails.findIndex(pd =>
      pd.product.id === packageDetail.product.id);

    if (existingPackageDetailIndex !== -1) {
      // ✅ Plain object kullan
      targetPackageDetails[existingPackageDetailIndex] = {
        ...targetPackageDetails[existingPackageDetailIndex],
        count: +targetPackageDetails[existingPackageDetailIndex].count + maxCount
      };
    } else {
      // ✅ Plain object kullan
      targetPackageDetails.push({
        ...packageDetail,
        count: maxCount
      });
    }

    // 5. Package'leri güncelle - ✅ Plain object
    const updatedSourcePackage = {
      ...sourcePackage,
      package_details: sourcePackageDetails
    };
    const updatedTargetPackage = {
      ...targetPackage,
      package_details: targetPackageDetails
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
  on(StepperPackageActions.removePackageDetailFromPackage, (state: StepperState, { pkgId, packageDetailIndex }) => {
    const currentPackages = state.step2State.packages;
    const pkg = currentPackages.find(p => p.id === pkgId);

    if (!pkg) {
      return state;
    }

    const currentRemainingProducts = state.step2State.remainingProducts;
    const productToRemove = pkg.package_details[packageDetailIndex];

    if (!productToRemove) {
      return state;
    }

    const updatedPackageDetails = [...pkg.package_details];
    const removedPackageDetail = updatedPackageDetails.splice(packageDetailIndex, 1)[0];

    const updatedPackage = { ...pkg, package_details: updatedPackageDetails };
    const updatedPackages = currentPackages.map(p =>
      p.id === pkgId ? updatedPackage : { ...p }
    );

    const updatedRemainingProducts = [...currentRemainingProducts, { ...removedPackageDetail }];

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

    let updatedPackages = currentPackages.filter(p => p.id !== packageId);
    updatedPackages.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    const remainingProducts = consolidatePackageDetails(
      state.step2State.remainingProducts.concat(packageToDelete.package_details || [])
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
    const allPackageDetails: PackageDetailReadDto[] = [];

    for (const pkg of state.step2State.packages) {
      if (pkg.package_details?.length > 0) {
        allPackageDetails.push(...pkg.package_details);
      }
    }

    const remainingProducts = consolidatePackageDetails([
      ...state.step2State.remainingProducts,
      ...allPackageDetails
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
  on(StepperPackageActions.splitPackageDetail, (state: StepperState, { packageDetailId, splitCount }) => {
    const packageDetail = state.step2State.remainingProducts.find(pd => pd.id === packageDetailId);

    if (!packageDetail) {
      return state;
    }

    if (packageDetail.count <= 1) {
      return state;
    }

    const currentPackageDetails = state.step2State.remainingProducts;
    let validatedCount: number;
    let isCustomSplit = false;

    if (splitCount !== undefined && splitCount !== null) {
      if (splitCount <= 0 || splitCount >= packageDetail.count) {
        return state;
      }
      validatedCount = splitCount;
      isCustomSplit = true;
    } else {
      validatedCount = Math.floor(packageDetail.count / 2);
      isCustomSplit = false;
    }

    const originalIndex = currentPackageDetails.findIndex(pd => pd.id === packageDetailId);

    if (originalIndex === -1) {
      return state;
    }

    let remainingProducts: any[];

    if (isCustomSplit) {
      const firstPart = {
        ...packageDetail,
        id: Guid(),
        count: validatedCount,
      };

      const secondPart = {
        ...packageDetail,
        id: Guid(),
        count: packageDetail.count - validatedCount,
      };

      remainingProducts = [...currentPackageDetails];
      remainingProducts.splice(originalIndex, 1, firstPart, secondPart);
    } else {
      const firstHalf = {
        ...packageDetail,
        id: Guid(),
        count: validatedCount,
      };

      const secondHalf = {
        ...packageDetail,
        id: Guid(),
        count: packageDetail.count - validatedCount,
      };

      remainingProducts = [...currentPackageDetails];
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
  on(StepperPackageActions.upsertPackageDetailCount, (state: StepperState, { packageDetail, count }) => {
    const existingRemainingProductIndex = state.step2State.remainingProducts.findIndex(
      item => item.product.id === packageDetail.product.id
    );

    let updatedRemainingProducts = [...state.step2State.remainingProducts];

    if (existingRemainingProductIndex !== -1) {
      updatedRemainingProducts = updatedRemainingProducts.map((p, i) =>
        i === existingRemainingProductIndex ? { ...p, count: count || 0 } : { ...p }
      );
    } else {
      const newPackageDetail: PackageDetailReadDto = {
        ...packageDetail,
        id: Guid(),
        count: 0,
      };
      updatedRemainingProducts = [...updatedRemainingProducts, newPackageDetail];
    }

    return {
      ...state,
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
      state.step1State.originalOrderDetails
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
  on(StepperPackageActions.upsertManySuccess, (state: StepperState, { packages }) => {
    const sortedPackages = [...packages].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    const emptyPackageNo = toInteger(sortedPackages.at(-1)?.name) + 1;
    const uiPackages = mapPackageReadDtoListToIUiPackageList(sortedPackages);

    return {
      ...state,
      completedStep: 2,
      step2State: {
        ...state.step2State,
        packages: [...uiPackages, createEmptyPackage(emptyPackageNo, state.order)],
        originalPackages: sortedPackages,
        addedPackages: [],
        modifiedPackages: [],
        deletedPackageIds: [],
      }
    };
  }),

  // Calculate Package Changes
  on(StepperPackageActions.calculatePackageChanges, (state: StepperState) => {

    const packages = state.step2State.packages;
    const originalPackages = state.step2State.originalPackages;


    const changes = calculatePackageChanges(packages, originalPackages);
    const isDirty = originalPackages.length === 0
      ? false
      : (changes.added.length > 0 ||
        changes.modified.length > 0 ||
        changes.deletedIds.length > 0);


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

// Helper function
function safeNumber(value: any): number {
  return typeof value === 'number' && !isNaN(value) ? value : 0;
}

function calculateUsedVolume(packageDetails: PackageDetailReadDto[]): number {
  return packageDetails.reduce((total, pd) => {
    const itemVolume =
      safeNumber(Number(pd.product.dimension?.width)) *
      safeNumber(Number(pd.product.dimension?.depth)) *
      safeNumber(Number(pd.product.dimension?.height));
    return total + (itemVolume * safeNumber(pd.count));
  }, 0);
}

function getPalletFillPercentage(
  pallet: UiPallet,
  packageDetails: PackageDetailReadDto[]
): number {
  if (!pallet?.dimension) {
    return 0;
  }

  const palletTotalVolume =
    safeNumber(Number(pallet.dimension.width)) *
    safeNumber(Number(pallet.dimension.depth)) *
    safeNumber(Number(pallet.dimension.height));

  const usedVolume = calculateUsedVolume(packageDetails);

  return Math.round((usedVolume / palletTotalVolume) * 100);
}
