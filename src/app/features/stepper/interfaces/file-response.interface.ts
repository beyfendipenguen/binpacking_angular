import { Order } from "@app/features/interfaces/order.interface";

export interface FileResponse {
  id: string;
  file: string;
  order: Order;
}
