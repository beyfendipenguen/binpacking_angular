import { OrderDetailRead, OrderDetailWrite } from "@features/interfaces/order-detail.interface";
import { Product } from "@features/interfaces/product.interface";
import { OrderDetailChanges } from "@features/stepper/components/invoice-upload/models/invoice-upload-interfaces";
import { PackageDetailReadDto } from "../interfaces/package-detail.interface";
import { v4 as Guid } from "uuid";


export class OrderDetailDiffCalculator {

  /**
   * mapperOrderDetails (UI'dan gelen) ile originalOrderDetails (DB'den gelen) karşılaştırır
   * ve added, modified, deleted değişikliklerini döner
   */
  static calculateDiff(
    mapperOrderDetails: OrderDetailRead[],
    originalOrderDetails: OrderDetailRead[]
  ): OrderDetailChanges {

    const changes: OrderDetailChanges = {
      added: [],
      modified: [],
      deletedIds: []
    };

    // Aynı ürün orijinalde BİRDEN FAZLA satır olarak bulunabilir (ERP içe
    // aktarma / sipariş birleştirme sonrası). Pallet control'ün mapper'ı ürün
    // başına tek satıra konsolide eder (satır id'leri yeni üretilir); eskiden
    // sadece İLK orijinal satır güncelleniyor, diğerleri dokunulmadan kalıyordu
    // → sipariş detay toplamı gerçeğinden fazla çıkıyordu.
    //
    // 1) Satır id'si ve ürünü orijinalle AYNI olan mapper satırı (fatura
    //    ekranı: kullanıcı satırları tek tek düzenler) id ile eşleşir.
    // 2) Kalan mapper satırları ürün bazında, henüz eşleşmemiş orijinal
    //    satırlarla gruplanır: ilk satır toplam adetle güncellenir, fazla
    //    satırlar silinecek olarak işaretlenir.
    // 3) Hiçbir mapper satırıyla eşleşmeyen orijinaller silinir.
    const originalById = new Map<string, OrderDetailRead>();
    originalOrderDetails.forEach(od => originalById.set(String(od.id), od));

    const claimedIds = new Set<string>();
    const unmatchedMappers: OrderDetailRead[] = [];

    mapperOrderDetails.forEach(mapperDetail => {
      const original = originalById.get(String(mapperDetail.id));
      if (
        original &&
        !claimedIds.has(String(original.id)) &&
        String(original.product.id) === String(mapperDetail.product.id)
      ) {
        claimedIds.add(String(original.id));
        if (+original.count !== +mapperDetail.count) {
          changes.modified.push({
            ...this.orderDetailReadToWrite(original),
            count: +mapperDetail.count
          });
        }
      } else {
        unmatchedMappers.push(mapperDetail);
      }
    });

    unmatchedMappers.forEach(mapperDetail => {
      const group = originalOrderDetails.filter(od =>
        !claimedIds.has(String(od.id)) &&
        String(od.product.id) === String(mapperDetail.product.id)
      );

      if (group.length === 0) {
        changes.added.push(this.orderDetailReadToWrite(mapperDetail));
        return;
      }

      const [primary, ...extras] = group;
      claimedIds.add(String(primary.id));
      if (extras.length > 0 || +primary.count !== +mapperDetail.count) {
        changes.modified.push({
          ...this.orderDetailReadToWrite(primary),
          count: +mapperDetail.count
        });
      }
      extras.forEach(extra => {
        claimedIds.add(String(extra.id));
        changes.deletedIds.push(extra.id);
      });
    });

    originalOrderDetails
      .filter(od => !claimedIds.has(String(od.id)))
      .forEach(od => changes.deletedIds.push(od.id));

    return changes;
  }

  static orderDetailReadToWrite(orderDetail: OrderDetailRead): OrderDetailWrite {
    const { product, ...rest } = orderDetail;
    return {
      ...rest,
      product_id: product.id
    };
  }
}
