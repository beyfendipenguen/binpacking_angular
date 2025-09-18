import { UiPackage } from '../../admin/components/stepper/components/ui-models/ui-package.model';
import { OrderDetail } from '../order-detail.interface';
import { Product } from '../product.interface';
import { v4 as Guid } from 'uuid';

/**
 * UiPackage array'ini OrderDetail array'ine çevirir
 */
export function mapUiPackagesToOrderDetails(
  uiPackages: UiPackage[]
): OrderDetail[] {
  const orderDetails: OrderDetail[] = [];

  for (const uiPackage of uiPackages) {
    for (const uiProduct of uiPackage.products) {
      // Product bilgilerini çıkar (ui_id, count, priority, split hariç)
      const { ui_id, count, priority, split, ...productProperties } = uiProduct;
      const product: Product = productProperties as Product;

      const orderDetail: OrderDetail = {
        // ZeroModel properties
        id: Guid(),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_time: null,
        is_deleted: false,

        // OrderDetail properties
        order: uiPackage.order,
        product: product,
        product_id: product.id || null,
        count: uiProduct.count,
        unit_price: 0,
        total_price: 0,
        remaining_count: uiProduct.count,
      };

      orderDetails.push(orderDetail);
    }
  }

  return orderDetails;
}
