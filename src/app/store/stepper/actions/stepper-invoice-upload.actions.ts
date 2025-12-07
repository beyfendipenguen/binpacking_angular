import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Order } from '@features/interfaces/order.interface';
import { OrderDetailRead } from '@app/features/interfaces/order-detail.interface';
import { Document } from '@app/features/interfaces/file.interface';

export const StepperInvoiceUploadActions = createActionGroup({
  source: 'Stepper Invoice Upload',
  events: {
    //Order Detail
    'Upsert Many': emptyProps(),
    'Upsert Many Success': props<{ orderDetails: OrderDetailRead[] }>(),
    'Upsert Many Failure': props<{ error: any }>(),
    // Manuel Ekleme/Silme Sonrası Triggerlar
    'Add Order Detail': props<{ orderDetail: OrderDetailRead }>(),
    'Update Order Detail': props<{ orderDetail: OrderDetailRead }>(),
    'Delete Order Detail': props<{ id: string }>(),
    'Calculate Order Detail Changes': emptyProps(),

    // Order CRUD
    'Set': props<{ order: Order }>(),
    'Patch': props<{ changes: Partial<Order> }>(),
    'Save': emptyProps(),
    'Save Success': props<{ order: Order }>(),
    'Save Failure': props<{ error: string }>(),

    // Fatura/Dosya Yükleme Süreci
    'Upload Invoice Process File': emptyProps(),
    'Upload Invoice Process File Success': emptyProps(),
    'Initialize Invoice Upload State From Upload': props<{
      order: Order,
      orderDetails: OrderDetailRead[],
      hasFile: boolean,
      fileName: string
    }>(),

    // Sipariş Dosyası Yükleme (Görsel vb.)
    'Upload File To Order': emptyProps(),
    'Upload File To Order Success': emptyProps(),
    'Set File Exists': props<{ isFileExists: boolean }>(),

    // Submit ve Save
    'Invoice Upload Step Submit': emptyProps(),

    // Template File
    'Get Report Template File': props<{ file: Document }>()
  }
});
