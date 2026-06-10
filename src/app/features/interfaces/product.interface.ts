import { Base } from "@core/interfaces/base.interface";
import { Company } from "./company.interface";
import { Dimension } from "./dimension.interface";
import { ProductType } from "./product-type.interface";
import { ProductWeight } from "./weight-category.interface";

export interface Product extends Base {
  name?: string;
  product_type: ProductType;
  type_name?: string;
  barcode?: string | null;
  dimension: Dimension;
  weights: ProductWeight[];  // weight_type → weights array
  company?: Company;
}

