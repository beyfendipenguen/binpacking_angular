import { BaseModel } from "./base-model.interface";
import { Dimension } from "./dimension.interface";

export interface Truck extends BaseModel {
  dimension: Dimension;
  name: string;
}
