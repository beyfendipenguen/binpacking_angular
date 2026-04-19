import { Base } from "@core/interfaces/base.interface";
import { Company } from "./company.interface";
import { Dimension } from "./dimension.interface";
import { ProductType } from "./product-type.interface";
import { ProductWeight } from "./weight-category.interface";

export interface Product extends Base {
  name?: string;
  product_type: ProductType;
  type_name?: string;
  dimension: Dimension;
  weights: ProductWeight[];  // weight_type → weights array
  company?: Company;
}

export interface BulkUploadResponse {
  total_rows: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: {
    row: number;
    message: string;
  }[];
  success_details: {
    row: number;
    message: string;
  }[];
}
