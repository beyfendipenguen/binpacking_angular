import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperOrderActions } from '../actions/stepper-order.actions'; // Yeni oluşturduğumuz action
import { OrderActions } from '../actions/order.actions'; // Eski CRUD actionları

export const stepperOrderHandlers = [
  // Order Setleme
  on(OrderActions.set, (state: StepperState, { order }) => ({
    ...state,
    order: order,
    isOrderDirty: false
  })),

  // Edit Mode
  on(StepperOrderActions.enableEditMode, (state: StepperState) => ({
    ...state,
    loading: true
  })),

  // Fatura Yükleme Başlangıcı (State'i sıfırlayıp yükleme moduna geçiyorsa)
  on(StepperOrderActions.initializeStep1StateFromUpload, (state: StepperState, { order, orderDetails, hasFile, fileName }) => ({
    ...state,
    order,
    orderDetails,
    hasFile,
    fileName,
    // ... diğer fieldlar
  })),

  // Dosya Yükleme Durumları
  on(StepperOrderActions.uploadFileToOrderSuccess, (state: StepperState) => ({
    ...state,
    fileExists: true
  })),

  // Order Details Güncellemeleri
  on(StepperOrderActions.updateOrderDetailsSuccess, (state: StepperState, { orderDetails }) => ({
    ...state,
    orderDetails: orderDetails,
    isOrderDetailsDirty: false
  })),

  // Manuel Ekleme/Silme (Order Detail)
  on(StepperOrderActions.addOrderDetail, (state: StepperState, { orderDetail }) => ({
    ...state,
    orderDetails: [...state.orderDetails, orderDetail],
    isOrderDetailsDirty: true
  })),
  on(StepperOrderActions.deleteOrderDetail, (state: StepperState, { id }) => ({
    ...state,
    orderDetails: state.orderDetails.filter(od => od.id !== id),
    isOrderDetailsDirty: true
  }))
];
