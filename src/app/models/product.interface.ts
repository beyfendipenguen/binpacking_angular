import { BaseModel } from "./base-model.interface";
import { Dimension } from "./dimension.interface";
import { ProductType } from "./product-type.interface";
import { WeightType } from "./weight-type.interface";

export interface Product extends BaseModel {
  name: string;
  product_type: ProductType;
  dimension: Dimension;
  weight_type: WeightType;
}
