import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Order } from '@features/interfaces/order.interface';
import { OrderDetailRead } from '@app/features/interfaces/order-detail.interface';

export const StepperOrderActions = createActionGroup({
  source: 'Stepper Order',
  events: {
    // Edit Modu
    'Enable Edit Mode': props<{ orderId: string }>(),

    'Set': props<{ order: Order }>(),
    'Patch': props<{ changes: Partial<Order> }>(),
    'Save': emptyProps(),
    'Save Success': props<{ order: Order }>(),
    'Save Failure': props<{ error: string }>(),

    // Fatura/Dosya Yükleme Süreci
    'Upload Invoice Process File': emptyProps(),
    'Upload Invoice Process File Success': emptyProps(),
    'Initialize Step1 State From Upload': props<{
      order: Order,
      orderDetails: OrderDetailRead[],
      hasFile: boolean,
      fileName: string
    }>(),

    // Sipariş Dosyası Yükleme (Görsel vb.)
    'Upload File To Order': emptyProps(), // OrderActions içindekini buraya alıyoruz
    'Upload File To Order Success': emptyProps(),

    // Sync ve Save
    'Sync Invoice Upload Step': emptyProps(),

    // Order Detail Güncellemeleri (Toplu işlemler)
    'Update Order Details Success': props<{ orderDetails: OrderDetailRead[] }>(),
    'Create Order Details Success': emptyProps(),

    // Manuel Ekleme/Silme Sonrası Triggerlar
    'Add Order Detail': props<{ orderDetail: OrderDetailRead }>(),
    'Update Order Detail': props<{ orderDetail: OrderDetailRead }>(),
    'Delete Order Detail': props<{ id: string }>(),
    'Calculate Order Detail Changes': emptyProps()
  }
});
