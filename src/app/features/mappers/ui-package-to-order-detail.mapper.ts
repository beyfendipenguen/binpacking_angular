import { v4 as Guid } from 'uuid';
import { OrderDetailRead } from '../interfaces/order-detail.interface';
import { UiProduct } from '../stepper/components/ui-models/ui-product.model';
import { IUiPackage } from '../stepper/interfaces/ui-interfaces/ui-package.interface';
import { PackageDetailReadDto } from '../interfaces/package-detail.interface';

/**
 * UiPackage array'ini OrderDetail array'ine çevirir
 */
export function mapUiPackagesToOrderDetails(
  uiPackages: IUiPackage[]
): OrderDetailRead[] {
  const packageDetails = uiPackages.flatMap(uiPackage => uiPackage.package_details)
  const consolidatedPackageDetails = packageDetails.reduce((acc, packageDetail) => {
    if (!acc[packageDetail.product.id]) {
      acc[packageDetail.product.id] = { ...packageDetail };
    } else {
      acc[packageDetail.product.id] = {
        ...packageDetail,
        count: acc[packageDetail.product.id].count + packageDetail.count
      };
    }
    return acc;
  }, {} as Record<string, PackageDetailReadDto>);

  return Object.values(consolidatedPackageDetails).map(packageDetail => {
    return {
      id: Guid(),
      order_id: "",
      count: packageDetail.count,
      unit_price: "1",
      remaining_count: packageDetail.count,
      product: packageDetail.product

    }
  })
}
