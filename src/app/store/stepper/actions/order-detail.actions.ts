import { OrderDetailRead } from "@app/features/interfaces/order-detail.interface";
import { createAction, props } from "@ngrx/store";


export const OrderDetailActions = {
    upsertMany: createAction(
        '[OrderDetail/API] Upsert Many'
    ),
    upsertManySuccess: createAction(
        '[OrderDetail/API] Upsert Many Success',
        props<{ orderDetails: OrderDetailRead[] }>()
    ),
    upsertManyFailure: createAction(
        '[OrderDetail/API] Upsert Many Failure',
        props<{ error: any }>()
    )

} 