import { Company } from '@app/features/interfaces/company.interface';
import { Dimension } from '@app/features/interfaces/dimension.interface';
import { ProductType } from '@app/features/interfaces/product-type.interface';
import { WeightType } from '@app/features/interfaces/weight-type.interface';
import { v4 as Guid } from 'uuid';
import { IUiProduct } from '../../interfaces/ui-interfaces/ui-product.interface';

export class UiProduct implements IUiProduct {
  ui_id: string;
  name?: string;
  count: number;
  product_type: ProductType;
  dimension: Dimension;
  weight_type: WeightType;
  company?: Company | undefined;
  id: string;
  priority: number;

  constructor(init: Partial<IUiProduct>) {
    this.ui_id = Guid()
    this.name = init.name!;
    this.count = init.count!;
    this.id = init.id!;
    this.product_type = init.product_type!;
    this.dimension = init.dimension!;
    this.weight_type = init.weight_type!;
    this.company = init.company;
    this.priority = init.priority!;
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

    // this additional id part to use in draggable component [id] attribute
    // if both products has same id then draggable component is not unique
    // and it will not work properly
    const firstProduct = new UiProduct({
      ...this,
      count: firstCount,
    });

    const secondProduct = new UiProduct({
      ...this,
      count: secondCount,
    });
    return [firstProduct, secondProduct];
  }

}
