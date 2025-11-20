import { Base } from "@core/interfaces/base.interface";

export interface Dimension extends Base {
  width: number;
  height: number;
  depth: number;
  unit: string;
  dimension_type: string;
  volume: number;
}
