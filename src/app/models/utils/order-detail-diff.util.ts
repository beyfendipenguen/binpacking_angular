import { UiProduct } from "../../admin/components/stepper/components/ui-models/ui-product.model";
import { OrderDetail } from "../order-detail.interface";


export interface OrderDetailChanges {
  added: OrderDetail[];
  modified: OrderDetail[];
  deleted: OrderDetail[];
}

export class OrderDetailDiffCalculator {

  /**
   * mapperOrderDetails ile originalOrderDetails'i karşılaştırır
   * ve added, modified, deleted değişikliklerini döner
   */
  static calculateDiff(
    mapperOrderDetails: OrderDetail[],
    originalOrderDetails: OrderDetail[],
    remainingProducts: UiProduct[]
  ): OrderDetailChanges {

    const remainingOrderDetails = remainingProducts.map((product: UiProduct) =>
      ({ id: '', count: product.count, product_id: product.id } as OrderDetail)
    )

    // Product ID'ye göre Map'ler oluştur (performans için)
    const mapperMap = new Map<string, OrderDetail>();
    const originalMap = new Map<string, OrderDetail>();

    // Mapper OrderDetails'i Map'e dönüştür
    for (const detail of mapperOrderDetails) {
      const productId = detail.product_id || detail.product?.id;
      if (productId && mapperMap.has(productId)) {
        const existingDetail = mapperMap.get(productId)!;
        mapperMap.set(productId, { ...existingDetail, count: detail.count + existingDetail.count })
      } else {
        mapperMap.set(productId, detail);
      }
    }

    // remainingOrderDetails i mepperMap e ekle
    for (const detail of remainingOrderDetails) {
      const productId = detail.product_id || detail.product?.id;
      if (productId && mapperMap.has(productId)) {
        const existingDetail = mapperMap.get(productId)!;
        mapperMap.set(productId, { ...existingDetail, count: detail.count + existingDetail.count })
      } else {
        mapperMap.set(productId, detail);
      }
    }

    // mapperMap de ayni keye sagip olan value larin countlarini topla
    const combinedMapperMap = new Map<string, OrderDetail>();
    for (const [productId, detail] of mapperMap.entries()) {
      if (combinedMapperMap.has(productId)) {
        const existingDetail = mapperMap.get(productId)!;
        combinedMapperMap.set(productId, { ...existingDetail, count: existingDetail.count + detail.count });
      } else {
        combinedMapperMap.set(productId, { ...detail });
      }
    }
    mapperMap.clear();
    for (const [productId, detail] of combinedMapperMap.entries()) {
      mapperMap.set(productId, detail);
    }


    // Original OrderDetails'i Map'e dönüştür
    for (const detail of originalOrderDetails) {
      const productId = detail.product_id || detail.product?.id;
      if (productId) {
        originalMap.set(productId, detail);
      }
    }

    const added: OrderDetail[] = [];
    const modified: OrderDetail[] = [];
    const deleted: OrderDetail[] = [];

    // ADDED ve MODIFIED kontrolü - mapper'da olan ürünler
    for (const [productId, mapperDetail] of mapperMap) {
      const originalDetail = originalMap.get(productId);

      if (!originalDetail) {
        // Original'de yok, mapper'da var = ADDED
        added.push(mapperDetail);
      } else {
        // Her ikisinde de var, count karşılaştır
        if (mapperDetail.count !== originalDetail.count) {
          // Count farklı = MODIFIED
          // Modified için original detail'in ID'sini kullan ama mapper'dan gelen count'u al
          const modifiedDetail: OrderDetail = {
            ...originalDetail, // Original detail'i kopyala (ID'si için)
            count: mapperDetail.count, // Yeni count değeri
            total_price: mapperDetail.unit_price * mapperDetail.count // Toplam fiyatı güncelle
          };
          modified.push(modifiedDetail);
        }
        // Count aynıysa değişiklik yok, hiçbir yere ekleme
      }
    }

    // DELETED kontrolü - original'de olan ama mapper'da olmayan ürünler
    for (const [productId, originalDetail] of originalMap) {
      if (!mapperMap.has(productId)) {
        // Mapper'da yok, original'de var = DELETED
        deleted.push(originalDetail);
      }
    }

    return {
      added,
      modified,
      deleted
    };
  }

  /**
   * Değişiklik sayılarını döner (debug için)
   */
  static getChangeSummary(changes: OrderDetailChanges): string {
    return `Added: ${changes.added.length}, Modified: ${changes.modified.length}, Deleted: ${changes.deleted.length}`;
  }

  /**
   * Değişiklik var mı kontrolü
   */
  static hasChanges(changes: OrderDetailChanges): boolean {
    return changes.added.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0;
  }
}
