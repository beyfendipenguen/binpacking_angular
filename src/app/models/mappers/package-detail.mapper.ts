import { UiPackage } from '../../admin/components/dashboard/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '../../admin/components/dashboard/stepper/components/ui-models/ui-pallet.model';
import { UiProduct } from '../../admin/components/dashboard/stepper/components/ui-models/ui-product.model';
import { PackageDetail } from '../package-detail.interface';
import { v4 as Guid } from 'uuid';
import { Product } from '../product.interface';
export function mapPackageDetailToPackage(packageDetailList: PackageDetail[]): UiPackage[] {
  const uniquePackageIds = new Set<string>();
  packageDetailList.forEach((detail) => {
    const packageId = detail.package ? detail.package.id : detail.package_id;
    if (packageId) uniquePackageIds.add(packageId);
  });

  const palletIdCounters = new Map<string, number>();

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

      if (packageData.pallet) {

        const originalPalletId = packageData.pallet.id;
        if (originalPalletId) {

          const currentCount = palletIdCounters.get(originalPalletId) || 0;
          palletIdCounters.set(originalPalletId, currentCount + 1);
          const uniquePalletId = currentCount === 0
            ? originalPalletId
            : `${originalPalletId}/${currentCount}`;

          pallet = {
            ...packageData.pallet,
            id: uniquePalletId
          };
        } else {
          pallet = packageData.pallet;
        }
      } else if (packageData.pallet_id) {

        const originalPalletId = packageData.pallet_id;
        const currentCount = palletIdCounters.get(originalPalletId) || 0;
        palletIdCounters.set(originalPalletId, currentCount + 1);

        const uniquePalletId = currentCount === 0
          ? originalPalletId
          : `${originalPalletId}/${currentCount}`;

        pallet = {
          id: uniquePalletId
        };
      }

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
      });
    }
  );

  return packageList;
}

export function mapPackageToPackageDetailReadSerializer(uiPackageList: UiPackage[]): PackageDetail[] {
  const packageDetailList: PackageDetail[] = []

  uiPackageList.forEach((uiPackage) => {
    // For each product in the UiPackage, create a PackageDetail
    uiPackage.products.forEach((uiProduct) => {
      const product: Product = {
        product_type: uiProduct.product_type,
        dimension: uiProduct.dimension,
        weight_type: uiProduct.weight_type,
        id: uiProduct.id
      }
      const packageDetail: PackageDetail = {
        id: Guid(), // Unique ID for the package detail
        count: uiProduct.count,
        priority: uiProduct.priority,
        product: product,
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
          order: uiPackage.order,
          pallet: uiPackage.pallet
        };

      }

      // Product için ID referansı kullan
      packageDetail.product_id = uiProduct.id;

      packageDetailList.push(packageDetail);
    });
  });

  return packageDetailList;
}


export function mapPackageToPackageDetailWriteSerializer(uiPackageList: UiPackage[]): PackageDetail[] {
  const packageDetailList: PackageDetail[] = [];

  uiPackageList.forEach((uiPackage) => {
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
          pallet:uiPackage.pallet,
          order:uiPackage.order
        };

        // Pallet için ID referansı kullan (eğer varsa)
        if (uiPackage.pallet && uiPackage.pallet.id) {
          packageDetail.package.pallet_id = extractPalletId(uiPackage.pallet.id);
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

// Helper function to extract pallet ID
function extractPalletId(palletId: string): string {
  return typeof palletId === 'string' ? palletId.split('/')[0] : palletId;
}
