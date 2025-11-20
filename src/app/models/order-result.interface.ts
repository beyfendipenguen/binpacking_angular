
import { Company } from "./company.interface";
import { Order } from "./order.interface";
import { Base } from "../core/interfaces/base.interface";

export interface OrderResult extends Base {
  order: Order;
  company: Company;
  result: string;
  success: boolean;
  progress: number; // 0-100 arası
}
