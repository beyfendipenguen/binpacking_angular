import { UiProduct } from '../../admin/components/stepper/components/ui-models/ui-product.model';
import { IUiPackage } from '../../admin/components/stepper/interfaces/ui-interfaces/ui-package.interface';
import { OrderDetailRead } from '../order-detail.interface';
import { v4 as Guid } from 'uuid';

/**
 * UiPackage array'ini OrderDetail array'ine çevirir
 */
export function mapUiPackagesToOrderDetails(
  uiPackages: IUiPackage[]
): OrderDetailRead[] {
  const products = uiPackages.flatMap(uiPackage => uiPackage.products)
  const uniqueProducts = products.reduce((acc, product) => {
    if (!acc[product.id]) {
      acc[product.id] = { ...product };
    } else {
      acc[product.id] = {
        ...product,
        count: acc[product.id].count + product.count
      };
    }
    return acc;
  }, {} as Record<string, UiProduct>);

  return Object.values(uniqueProducts).map(product => {
    return {
      id: Guid(),
      order_id: "",
      count: product.count,
      unit_price: "1",
      remaining_count: product.count,
      product: {
        id: product.id,
        name: product.name,
        count: product.count,
        dimension: { ...product.dimension },
        product_type: { ...product.product_type },
        weight_type: { ...product.weight_type }
      },
    }
  })
}
