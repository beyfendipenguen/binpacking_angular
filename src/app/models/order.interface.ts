import { CompanyRelation } from "./company-relation.interface";
import { Truck } from "./truck.interface";
import { ZeroModel } from "./zero-model.interface";

export interface Order extends ZeroModel {
  date: string; // ISO 8601 tarih formatı: "2025-04-11T14:30:00"
  company_relation: CompanyRelation | null;
  weight_type: string;
  name: string;
  truck: Truck | null;
  max_pallet_height: number;
  truck_weight_limit: number;
}
