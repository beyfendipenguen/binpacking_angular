import { Signal } from "@angular/core";
import { Order } from "@app/features/interfaces/order.interface";
import { Package } from "@app/features/interfaces/package.interface";
import { IUiPallet } from "./ui-pallet.interface";
import { IUiProduct } from "./ui-product.interface";

export interface IUiPackage extends Package {
  pallet: IUiPallet | null;
  products: IUiProduct[];
  order: Order;
  is_remaining: boolean;

  readonly totalMeter: Signal<number>;
  readonly totalVolume: Signal<number>;
  readonly totalWeight: Signal<number>;

  isSavedInDb: boolean;

  readonly productsSignal: Signal<IUiProduct[]>;
}
