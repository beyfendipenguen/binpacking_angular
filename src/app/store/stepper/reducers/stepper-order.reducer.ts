import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperInvoiceUploadActions } from '../actions/stepper-invoice-upload.actions';
import { Order } from '@app/features/interfaces/order.interface';
import { OrderDetailDiffCalculator } from '@features/utils/order-detail-diff.util';
import { mapUiPackagesToOrderDetails } from '@features/mappers/ui-package-to-order-detail.mapper';
import { isEqual } from 'lodash-es';
import { StepperUiActions } from '../actions/stepper-ui.actions';

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

  // Edit Mode
  on(StepperUiActions.enableEditMode, (state: StepperState) => ({
    ...state,
    isEditMode: true,
    loading: true
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
  on(StepperInvoiceUploadActions.setFileExists, (state: StepperState, {isFileExists}) => ({
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
    const originalDetail = state.step1State.originalOrderDetails.find(item => item.id === orderDetail.id);

    // OrderDetails array'ini güncelle (OrderDetailRead tipi)
    const orderDetails = state.step1State.orderDetails.map(detail =>
      detail.id === orderDetail.id ? orderDetail : detail
    );

    // OrderDetailRead'i OrderDetailWrite'a dönüştür
    const orderDetailWrite = OrderDetailDiffCalculator.orderDetailReadToWrite(orderDetail);

    // Added array'ini güncelle (OrderDetailWrite tipi)
    const added = state.step1State.added.map(detail =>
      detail.id === orderDetail.id ? orderDetailWrite : detail
    );

    const isOriginal = !!originalDetail;
    const isAlreadyModified = state.step1State.modified.some(item => item.id === orderDetail.id);

    let modified = [...state.step1State.modified];
    if (isOriginal && !isAlreadyModified && !isEqual(originalDetail, orderDetail)) {
      modified.push(orderDetailWrite);
    } else if (isAlreadyModified) {
      modified = modified.map(item => item.id === orderDetail.id ? orderDetailWrite : item);
    }

    const isDirty = modified.length > 0 || state.step1State.added.length > 0 || state.step1State.deletedIds.length > 0;

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

  on(StepperInvoiceUploadActions.deleteOrderDetail, (state: StepperState, { id }) => {
    const orderDetails = state.step1State.orderDetails.filter(item => item.id !== id);
    return {
      ...state,
      step1State: {
        ...state.step1State,
        orderDetails,
      }
    };
  }),

  // Calculate Order Detail Changes
  on(StepperInvoiceUploadActions.calculateOrderDetailChanges, (state: StepperState) => {
    const mapperOrderDetails = mapUiPackagesToOrderDetails(state.step2State.packages);
    const changes = OrderDetailDiffCalculator.calculateDiff(
      mapperOrderDetails,
      state.step1State.originalOrderDetails,
      state.step2State.remainingProducts
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
];
