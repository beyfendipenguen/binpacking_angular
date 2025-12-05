import { Base } from "@app/core/interfaces/base.interface";
import { Product } from "./product.interface";

export interface PackageDetailReadDto extends Base {
  package_id: string;
  product: Product;
  count: number;
  priority: number;
}

export interface PackageDetailWriteDto extends Base {
  package_id: string;
  product_id: string;
  count: number;
  priority: number;
}

