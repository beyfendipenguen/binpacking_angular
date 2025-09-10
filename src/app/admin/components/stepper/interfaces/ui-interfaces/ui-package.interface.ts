// ui-package.interface.ts
import { Signal } from '@angular/core';
import { Package } from "../../../../../models/package.interface";
import { IUiPallet } from "./ui-pallet.interface";
import { IUiProduct } from "./ui-product.interface";

export interface IUiPackage extends Package {
  pallet: IUiPallet | null;
  products: IUiProduct[];
  is_remaining : boolean;

  readonly totalMeter: Signal<number>;
  readonly totalVolume: Signal<number>;
  readonly totalWeight: Signal<number>;

  isSavedInDb: boolean;

  readonly productsSignal: Signal<IUiProduct[]>;
}
