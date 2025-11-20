import { Base } from "@app/core/interfaces/base.interface";
import { Package } from "./package.interface";
import { Product } from "./product.interface";

export interface PackageDetail extends Base {
  // Ya package nesnesi ya da package_id olabilir
  package?: Package;
  package_id?: string;

  // Ya product nesnesi ya da product_id olabilir
  product?: Product;
  product_id?: string;

  count: number;
  priority: number;
}
