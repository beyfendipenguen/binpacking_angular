import { Base } from "@app/core/interfaces/base.interface";

export interface WeightCategory extends Base {
  key: string;   // "std", "eco", "pre", "std_plus"
  label: string; // "STD", "ECO", "PRE"
}

export interface ProductWeight extends Base {
  category: WeightCategory;
  value: number;
}
