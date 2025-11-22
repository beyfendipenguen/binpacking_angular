import { Order } from "@app/features/interfaces/order.interface";

export interface OrderState {
    order: Order | null;
    originalOrder: Order | null;
    orderResultId: string;

}