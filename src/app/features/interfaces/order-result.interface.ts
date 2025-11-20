
import { Base } from "@app/core/interfaces/base.interface";
import { Company } from "./company.interface";
import { Order } from "./order.interface";

export interface OrderResult extends Base {
  order: Order;
  company: Company;
  result: string;
  success: boolean;
  progress: number; // 0-100 arası
}
