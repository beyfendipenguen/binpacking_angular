import { Order } from '@app/features/interfaces/order.interface';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
// note: eger bir action store da islem yapiyor ve backend islemi yapmiyorsa domain/store
// eger backend e gidiyor isie domain/api yapalim
// TODO:
//
export const OrderActions = createActionGroup({
  source: 'Order API',
  events: {
    // Edit Modu
    'Enable Edit Mode': props<{ orderId: string }>(),

    // CRUD İşlemleri
    'Set': props<{ order: Order }>(),
    'Patch': props<{ changes: Partial<Order> }>(),
    'Save': emptyProps(),
    'Save Success': props<{ order: Order }>(),
    'Save Failure': props<{ error: string }>(),

    // Dosya Yükleme (Fatura/Excel)
    'Upload Invoice Process File': emptyProps(),
    'Upload Invoice Process File Success': emptyProps(),
    'Upload Invoice Process File Failure': props<{ error: string }>(),

    // Sipariş Dosyası (Görsel vb.)
    'Upload File To Order': emptyProps(),
    'Upload File To Order Success': emptyProps(),
    'Upload File To Order Failure': props<{ error: string }>(),

    // Sync
    'Sync Invoice Upload Step': emptyProps(),
  }
});
