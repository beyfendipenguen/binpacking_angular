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
  // Siparişe özel meta veri (örn. ERP'den gelen preference/order_no) —
  // company_relation.extra_data ile KARIŞTIRILMAMALI, bkz. backend
  // Order.extra_data model docstring'i. generic-table'da 'name' kolonunun
  // tooltip'inde gösteriliyor (bkz. orders.component.ts columnDefinitions).
  extra_data?: Record<string, any> | null;
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
