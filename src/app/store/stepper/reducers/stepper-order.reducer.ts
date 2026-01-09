import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperInvoiceUploadActions } from '../actions/stepper-invoice-upload.actions';
import { Order } from '@app/features/interfaces/order.interface';
import { OrderDetailDiffCalculator } from '@features/utils/order-detail-diff.util';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { IUiPackage } from '@app/features/stepper/interfaces/ui-interfaces/ui-package.interface';
import { PackageDetailReadDto } from '@app/features/interfaces/package-detail.interface';

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

export const stepperOrderHandlers = [
  // Order Setleme
  on(StepperInvoiceUploadActions.set, StepperInvoiceUploadActions.set, (state: StepperState, { order }) => ({
    ...state,
    order: { ...order },
  })),

  // Order Patch
  on(StepperInvoiceUploadActions.patch, (state: StepperState, { changes }) => ({
    ...state,
    order: {
      ...state.order,
      ...changes
    } as Order
  })),

  // Order Save Success
  on(StepperInvoiceUploadActions.saveSuccess, StepperInvoiceUploadActions.saveSuccess, (state: StepperState, { order }) => ({
    ...state,
    order: order,
    originalOrder: order,
  })),

  // Fatura Yükleme Başlangıcı
  on(StepperInvoiceUploadActions.initializeInvoiceUploadStateFromUpload, (state: StepperState, { order, orderDetails, hasFile, fileName }) => ({
    ...state,
    order,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [], // File upload'da original yok
      added: orderDetails.map(od => OrderDetailDiffCalculator.orderDetailReadToWrite(od)),
      hasFile,
      fileName,
    }
  })),

  // Dosya Yükleme Durumları
  on(StepperInvoiceUploadActions.setFileExists, (state: StepperState, { isFileExists }) => ({
    ...state,
    fileExists: isFileExists
  })),

  on(StepperInvoiceUploadActions.uploadFileToOrderSuccess, StepperInvoiceUploadActions.uploadFileToOrderSuccess, (state: StepperState) => ({
    ...state,
    fileExists: false
  })),

  // Template File
  on(StepperInvoiceUploadActions.getReportTemplateFile, (state: StepperState, { file }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      templateFile: file
    }
  })),

  // Order Details Success
  on(StepperInvoiceUploadActions.upsertManySuccess, (state: StepperState, { orderDetails }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...orderDetails],
      originalOrderDetails: [...orderDetails],
      added: [],
      deletedIds: [],
      modified: [],
    }
  })),

  // Manuel Ekleme/Silme (Order Detail)
  on(StepperInvoiceUploadActions.addOrderDetail, (state: StepperState, { orderDetail }) => ({
    ...state,
    step1State: {
      ...state.step1State,
      orderDetails: [...state.step1State.orderDetails, orderDetail],
    }
  })),

  on(StepperInvoiceUploadActions.updateOrderDetail, (state: StepperState, { orderDetail }) => {

    const { keptPackages, extractedPackageDetails: extractedPackageDetails } = state.step2State.packages.reduce(
      (acc, pkg) => {
        const hasProduct = pkg.package_details.some(pd => pd.product.id === orderDetail.product.id);
        if (hasProduct) {
          acc.extractedPackageDetails.push(...pkg.package_details);
        } else {
          acc.keptPackages.push(pkg);
        }
        return acc;
      },
      { keptPackages: [] as IUiPackage[], extractedPackageDetails: [] as PackageDetailReadDto[] }
    );

    const sortedPackages = [...keptPackages].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    const remainingProducts = consolidatePackageDetails(extractedPackageDetails).map(p => p.id === orderDetail.product.id ? { ...p, count: orderDetail.count } : p);

    const orderDetails = state.step1State.orderDetails.map(item =>
      item.id === orderDetail.id ? { ...orderDetail } : item
    );

    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails
      },
      step2State: {
        ...state.step2State,
        packages: sortedPackages,
        remainingProducts,
      }
    };
  }),

  on(StepperInvoiceUploadActions.deleteOrderDetail, (state: StepperState, { id }) => {
    const newPackages = state.step2State.packages.map(pkg => {
      if (pkg.package_details.some(pd => pd.product.id === id)) {
        return {
          ...pkg,
          package_details: pkg.package_details.filter(pd => pd.product.id !== id)
        };
      }
      return pkg;
    }).filter(pkg => pkg.pallet && pkg.package_details.length > 0);
    const orderDetails = state.step1State.orderDetails.filter(item => item.id !== id);
    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails,
      },
      step2State: {
        ...state.step2State,
        packages: newPackages,
      }
    };
  }),

  // Calculate Order Detail Changes
  on(StepperInvoiceUploadActions.calculateOrderDetailChanges, (state: StepperState) => {
    const changes = OrderDetailDiffCalculator.calculateDiff(
      [...state.step1State.orderDetails],
      state.step1State.originalOrderDetails
    );
    return {
      ...state,
      step1State: {
        ...state.step1State,
        added: changes.added.map(od => ({ ...od })),
        modified: changes.modified.map(od => ({ ...od })),
        deletedIds: [...changes.deletedIds],
      }
    };
  }),
];
