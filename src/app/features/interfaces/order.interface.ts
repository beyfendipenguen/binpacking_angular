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

export interface PublicOrderViewData {
  order_id: string;
  created_at: string;
  company_name: string;
  organization_name: string;
  truck_dimensions: [number, number, number];
  order_result: PackagePosition[];
  package_count: number;
  total_weight: number;
}

export type PackagePosition = [
  number, number, number, // x, y, z
  number, number, number, // length, width, height
  number,                 // id
  number,                 // weight
  string                  // pkgId
];
