import { Order } from '@app/features/interfaces/order.interface';
import { ThreeJSTruckVisualizationComponent } from '@app/shared/threejs-truck-visualization/threejs-truck-visualization.component';
import { createAction, props } from '@ngrx/store';

// note: eger bir action store da islem yapiyor ve backend islemi yapmiyorsa domain/store
// eger backend e gidiyor isie domain/api yapalim
// TODO:
//

export const OrderActions = {
    set: createAction(
        '[Order] set Order',
        props<{ order: Order }>()
    ),

    patch: createAction(
        '[Order] patch Order',
        props<{ changes: Partial<Order> }>()
    ),

    save: createAction(
        '[Order/API] update or create order'
    ),

    saveSuccess: createAction(
        '[Order/API] update or create order success',
        props<{ order: Order }>()
    ),

    saveFailure: createAction(
        '[Order/API] update or create order failure',
        props<{ error: any }>()
    ),

    uploadFileToOrder: createAction(
        '[Order/API] Upload file to Order'
    ),

    uploadFileToOrderSuccess: createAction(
        '[Order/API] Upload file to Order Success',
    ),

    uploadFileToOrderFailure: createAction(
        '[Order/API] Upload file to Order Failure',
    )
}
