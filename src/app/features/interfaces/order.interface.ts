import { CompanyRelation } from "./company-relation.interface";
import { Truck } from "./truck.interface";
import { Base } from "@core/interfaces/base.interface";
import { WeightCategory } from "./weight-category.interface";

export interface Order extends Base {
  date: string;
  company_relation: CompanyRelation | null;
  weight_category: WeightCategory | null;  // weight_type string → WeightCategory objesi
  name: string;
  truck: Truck | null;
  max_pallet_height: number;
  truck_weight_limit: number;
}
