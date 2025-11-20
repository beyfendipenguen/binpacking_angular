import { v4 as Guid } from 'uuid';
import { PackageDetail } from '../interfaces/package-detail.interface';
import { UiPackage } from '../stepper/components/ui-models/ui-package.model';
import { UiPallet } from '../stepper/components/ui-models/ui-pallet.model';
import { UiProduct } from '../stepper/components/ui-models/ui-product.model';
import { IUiPackage } from '../stepper/interfaces/ui-interfaces/ui-package.interface';


export function mapPackageDetailToPackage(packageDetailList: PackageDetail[]): UiPackage[] {
  const uniquePackageIds = new Set<string>();
  packageDetailList.forEach((detail) => {
    const packageId = detail.package ? detail.package.id : detail.package_id;
    if (packageId) uniquePackageIds.add(packageId);
  });


  const packageList: UiPackage[] = Array.from(uniquePackageIds).map(
    (packageId) => {
      const packageDetails = packageDetailList.filter((detail) => {
        const detailPackageId = detail.package ? detail.package.id : detail.package_id;
        return detailPackageId === packageId;
      });

      const firstDetail = packageDetails[0];
      const packageData: any = firstDetail.package || {};

      let order, pallet;

      if (packageData.order) {
        order = packageData.order;
      } else if (packageData.order_id) {
        order = { id: packageData.order_id };
      }

      pallet = packageData?.pallet_id
        ? { id: packageData.pallet_id }
        : packageData?.pallet ?? null;


      const products = packageDetails.map(detail => {
        let productData;

        if (detail.product) {
          productData = { ...detail.product };
        } else if (detail.product_id) {
          productData = { id: detail.product_id };
        } else {
          productData = {};
        }

        return new UiProduct({
          ...productData,
          count: detail.count,
          priority: detail.priority
        });
      });

      return new UiPackage({
        id: packageId,
        name: packageData.name || `Package-${packageId.substring(0, 8)}`,
        pallet: pallet ? new UiPallet({ ...pallet }) : null,
        order: order,
        products: products,
        alignment: packageData.alignment
      });
    }
  );

  return packageList;
}

export function createTotalHeight(uiProducts: UiProduct[], pallet: UiPallet | null): number {
  let totalHeight = 0
  if (pallet != null) {
    uiProducts.forEach((uiProduct) => {
      const normalPosition = Math.floor(pallet.dimension.width / uiProduct.dimension.width) *
        Math.floor(pallet.dimension.depth / uiProduct.dimension.depth);

      const rotatedPosition = Math.floor(pallet.dimension.width / uiProduct.dimension.depth) *
        Math.floor(pallet.dimension.depth / uiProduct.dimension.width);

      const maxItemsPerLayer = Math.max(normalPosition, rotatedPosition);

      totalHeight += Math.floor(uiProduct.count / maxItemsPerLayer) * uiProduct.dimension.height
    })
    return totalHeight
  }

  return 2400
}
export function mapPackageToPackageDetail(uiPackageList: IUiPackage[]): PackageDetail[] {
  const packageDetailList: PackageDetail[] = [];

  uiPackageList.forEach((uiPackage) => {
    const totalHeight = createTotalHeight(uiPackage.products, uiPackage.pallet);
    // For each product in the UiPackage, create a PackageDetail
    uiPackage.products.forEach((uiProduct) => {
      const packageDetail: PackageDetail = {
        id: Guid(), // Unique ID for the package detail
        count: uiProduct.count,
        priority: uiProduct.priority
      };
      // Check if package is already saved in DB
      // Normally you would check this from a backend response flag or some other indicator
      // For this example, let's assume there's a property like 'isSavedInDb' in uiPackage
      // This might be set based on a response from your backend
      if (uiPackage.isSavedInDb === true) {
        // Mevcut bir package için ID referansı kullan
        packageDetail.package_id = uiPackage.id;
      } else {
        // Yeni bir package oluşturmak için tüm detayları içeren nesne kullan
        // Veritabanında olmayan, hesaplanmış package için tam nesne gönder
        packageDetail.package = {
          id: uiPackage.id || Guid(), // Eğer ID yoksa yeni bir ID oluştur
          name: uiPackage.name,
          pallet: uiPackage.pallet,
          order: uiPackage.order,
          is_remaining: uiPackage.is_remaining,
          height: totalHeight,
          alignment: uiPackage.alignment
        };

        // Pallet için ID referansı kullan (eğer varsa)
        if (uiPackage.pallet && uiPackage.pallet.id) {
          packageDetail.package.pallet_id = uiPackage.pallet.id;
        }

        // Order için ID referansı kullan
        if (uiPackage.order && uiPackage.order.id) {
          packageDetail.package.order_id = uiPackage.order.id;
        }
      }

      // Product için ID referansı kullan
      packageDetail.product_id = uiProduct.id;

      packageDetailList.push(packageDetail);
    });
  });

  return packageDetailList;
}
