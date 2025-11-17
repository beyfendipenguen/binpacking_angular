// ui-package.class.ts
import { signal, computed, Signal, WritableSignal } from '@angular/core';
import { Company } from "../../../../../models/company.interface";
import { Order } from "../../../../../models/order.interface";
import { IUiPackage } from "../../interfaces/ui-interfaces/ui-package.interface";
import { IUiPallet } from "../../interfaces/ui-interfaces/ui-pallet.interface";
import { IUiProduct } from "../../interfaces/ui-interfaces/ui-product.interface";

interface PackageTotals {
  meter: number;
  volume: number;
  weight: number;
}

export class UiPackage implements IUiPackage {
  // Non-reactive properties
  pallet: IUiPallet | null;
  order: Order;
  company?: Company | undefined;
  id: string;
  name: string;
  isSavedInDb: boolean;
  products: IUiProduct[];
  height: number;
  alignment:string;

  constructor(init: Partial<IUiPackage>) {
    this.pallet = init.pallet || null;
    this.order = init.order!;
    this.company = init.company;
    this.id = init.id!;
    this.name = init.name!;
    this.isSavedInDb = init.isSavedInDb || false;
    this.products = init.products || [];
    this.is_remaining = init.is_remaining || true;
    this.height = init.height || 2400;
    this.alignment = init.alignment || "h";

    // Initialize products signal
    this._products = signal(init.products || []);
  }
  is_remaining: boolean;
  pallet_id?: string | undefined;
  order_id?: string | undefined;

  // Signal-based reactive state
  private _products: WritableSignal<IUiProduct[]> = signal([]);

  // Computed totals - tek hesaplama ile tüm değerler
  private _totals: Signal<PackageTotals> = computed(() => {
    return this._calculateTotals(this._products());
  });

  // Individual computed signals (Interface compatibility)
  public readonly totalMeter: Signal<number> = computed(() => this._totals().meter);
  public readonly totalVolume: Signal<number> = computed(() => this._totals().volume);
  public readonly totalWeight: Signal<number> = computed(() => this._totals().weight);

  public readonly productsSignal: Signal<IUiProduct[]> = this._products.asReadonly();
  // Products getter/setter for compatibility

  // Optimized calculation - single loop for all totals
private _calculateTotals(products: IUiProduct[]): PackageTotals {
  if (!products?.length) {
    return { meter: 0, volume: 0, weight: 0 };
  }

  let meter = 0;
  let volume = 0;
  let weight = 0;

  // Single pass through products array
  for (const product of products) {
    const count = Number(product.count) || 0;

    // Meter calculation
    const depth = Number(product.dimension?.depth) || 0;
    meter += (count * depth) / 1000;

    // Volume calculation
    const productVolume = Number(product.dimension?.volume) || 0;
    volume += (count * productVolume) / 1000;

    // Weight calculation
    const std = Number(product.weight_type?.std) || 0;
    weight += count * std;
  }

  return {
    meter: Math.round(meter * 100) / 100,
    volume: Math.round(volume * 100) / 100,
    weight: Math.round(weight * 100) / 100
  };
}

  // Product manipulation methods
  addProduct(product: IUiProduct): void {
    this._products.update(products => [...products, product]);
  }

  removeProduct(productId: string): void {
    this._products.update(products =>
      products.filter(p => p.id !== productId)
    );
  }


}
