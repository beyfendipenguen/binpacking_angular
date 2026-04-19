import { Company } from '@app/features/interfaces/company.interface';
import { Dimension } from '@app/features/interfaces/dimension.interface';
import { ProductType } from '@app/features/interfaces/product-type.interface';
import { ProductWeight } from '@app/features/interfaces/weight-category.interface';
import { v4 as Guid } from 'uuid';
import { IUiProduct } from '../../interfaces/ui-interfaces/ui-product.interface';

export class UiProduct implements IUiProduct {
  ui_id: string;
  name?: string;
  count: number;
  product_type: ProductType;
  dimension: Dimension;
  weights: ProductWeight[];
  company?: Company | undefined;
  id: string;
  priority: number;

  constructor(init: Partial<IUiProduct>) {
    this.ui_id = Guid();
    this.name = init.name!;
    this.count = init.count!;
    this.id = init.id!;
    this.product_type = init.product_type!;
    this.dimension = init.dimension!;
    this.weights = init.weights ?? [];
    this.company = init.company;
    this.priority = init.priority!;
  }

  // weights array içinden key'e göre değer döner
  getWeight(key: string): number {
    const pw = this.weights.find(w => w.category.key === key);
    return pw ? Number(pw.value) : 0;
  }

  split(perItem?: number | null): UiProduct[] {
    if (this.count <= 1) {
      return [this];
    }
    const itemCount = perItem === undefined ? null : perItem;
    const firstCount = itemCount !== null ? itemCount : Math.ceil(this.count / 2);
    const secondCount = this.count - firstCount;

    if (firstCount <= 0 || secondCount <= 0) {
      return [this];
    }

    const firstProduct = new UiProduct({ ...this, count: firstCount });
    const secondProduct = new UiProduct({ ...this, count: secondCount });
    return [firstProduct, secondProduct];
  }
}
