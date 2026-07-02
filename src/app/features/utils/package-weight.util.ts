import { Order } from '@app/features/interfaces/order.interface';

/**
 * Palet + ürünlerin toplam ağırlığı (kg).
 * Order'ın weight_category key'ine göre ürün ağırlığını seçer.
 * PackageReadDto ve UiPackage ile çalışır (ikisi de pallet + package_details taşır).
 */
export function calculatePackageTotalWeight(pkg: any, order: Order | null): number {
  const palletWeight = Number(pkg?.pallet?.weight) || 0;
  const weightKey = order?.weight_category?.key ?? 'std';

  const productsWeight = (pkg?.package_details ?? []).reduce((total: number, pd: any) => {
    const productWeight = pd.product?.weights?.find(
      (w: any) => w.category?.key === weightKey
    );
    const weight = productWeight ? Number(productWeight.value) : 0;
    const count = Number(pd.count) || 0;
    return total + weight * count;
  }, 0);

  return Math.trunc((palletWeight + productsWeight) * 100) / 100;
}