import { OrderDetailRead } from "@app/features/interfaces/order-detail.interface";
import { createActionGroup, emptyProps, props } from "@ngrx/store";


export const OrderDetailActions  = createActionGroup({
  source: 'OrderDetailRead API',
  events: {
    'upsertMany': emptyProps(),
    'upsertManySuccess': props<{ orderDetails: OrderDetailRead[] }>(),
    'upsertManyFailure': props<{ error: any }>()

  }


});
