import { v4 as Guid } from 'uuid';
import { OrderDetailRead } from '../interfaces/order-detail.interface';
import { UiProduct } from '../stepper/components/ui-models/ui-product.model';
import { IUiPackage } from '../stepper/interfaces/ui-interfaces/ui-package.interface';

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
