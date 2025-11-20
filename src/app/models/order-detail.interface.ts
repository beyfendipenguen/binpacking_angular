import { Product } from "./product.interface";
import { Order } from "./order.interface";
import { Base } from "../core/interfaces/base.interface";

export interface OrderDetailRead extends Base {
  order_id: string,
  product: Product;
  count: number;
  unit_price: string;
  total_price?: number | null;
  remaining_count: number;
}

export interface OrderDetailWrite {
  id: string,
  order_id: string,
  product_id: string,
  count: number,
  unit_price: string,
  remaining_count: number
}
