import { Base } from "@app/core/interfaces/base.interface";
import { Dimension } from "./dimension.interface";

export interface Truck extends Base {
  dimension: Dimension;
  name: string;
}
