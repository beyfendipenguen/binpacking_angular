import { Product } from "./product.interface";
import { Order } from "./order.interface";
import { ZeroModel } from "./zero-model.interface";

export interface OrderDetail extends ZeroModel{
  order: Order;
  product: Product;
  product_id: string | null;
  count: number;
  unit_price: number;
  total_price: number;
  remaining_count: number;
}
