import { Base } from "../core/interfaces/base.interface";
import { Dimension } from "./dimension.interface";

export interface Pallet extends Base {
  dimension: Dimension;
  weight: number;
}
