import { Product } from "../../../../../models/product.interface";

export interface IUiProduct extends Product {
  ui_id: string;
  count: number;
  priority:number;

  split(perItem?: number | null): IUiProduct[];
}
