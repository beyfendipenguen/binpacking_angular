import { Product } from "@app/features/interfaces/product.interface";

export interface IUiProduct extends Product {
  ui_id: string;
  count: number;
  priority: number;

  split(perItem?: number | null): IUiProduct[];
}
