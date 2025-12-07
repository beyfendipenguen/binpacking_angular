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

    mapperOrderDetails.forEach(mapperDetail => {
      const originalDetail = originalOrderDetails.find(
        od => od.product.id === mapperDetail.product.id
      );

      if (!originalDetail) {
        changes.added.push(this.orderDetailReadToWrite(mapperDetail));
      } else if (+originalDetail.count !== +mapperDetail.count) {
        changes.modified.push({
          ...this.orderDetailReadToWrite(originalDetail),
          count: +mapperDetail.count
        });
      }
    });

    const mapperProductIds = new Set(
      mapperOrderDetails.map(md => md.product.id)
    );

    changes.deletedIds = originalOrderDetails
      .filter(od => !mapperProductIds.has(od.product.id))
      .map(od => od.id);

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
