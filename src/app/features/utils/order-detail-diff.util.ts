import { UiProduct } from "@features/stepper/components/ui-models/ui-product.model";
import { OrderDetailRead, OrderDetailWrite } from "@features/interfaces/order-detail.interface";
import { Product } from "@features/interfaces/product.interface";
import { OrderDetailChanges } from "@features/stepper/components/invoice-upload/models/invoice-upload-interfaces";
import { PackageDetailReadDto } from "../interfaces/package-detail.interface";


export class OrderDetailDiffCalculator {

  /**
   * mapperOrderDetails ile originalOrderDetails'i karşılaştırır
   * ve added, modified, deleted değişikliklerini döner
   * 
   */
  static calculateDiff(
    mapperOrderDetails: OrderDetailRead[],
    originalOrderDetails: OrderDetailRead[],
    remainingPackageDetails: PackageDetailReadDto[]
  ): OrderDetailChanges {

    let mergedRemainingPackageDetails = remainingPackageDetails.reduce((acc, packageDetail) => {
      if (!acc.some(p => p.id === packageDetail.id)) {
        acc.push(packageDetail);
      } else {
        const existingPackageDetail = acc.find(p => p.id === packageDetail.id);
        if (existingPackageDetail) {
          existingPackageDetail.count += packageDetail.count;
        }
      }
      return acc;
    }, [] as PackageDetailReadDto[]);


    mapperOrderDetails.map(orderDetail => {
      const remainingPackageDetail = mergedRemainingPackageDetails.find(p => p.product.id === orderDetail.product.id)
      return remainingPackageDetail ? { ...orderDetail, count: orderDetail.count + remainingPackageDetail.count } : orderDetail
    });

    mergedRemainingPackageDetails.forEach(packageDetail => {
      if (!mapperOrderDetails.some(orderDetail => orderDetail.product.id === packageDetail.product.id)) {
        mapperOrderDetails.push({
          id: "",
          count: packageDetail.count,
          unit_price: "1",
          remaining_count: 0,
          product: packageDetail.product as Product,
          order_id: "",
        } as OrderDetailRead)
      }
    })


    let changes = mapperOrderDetails.reduce((acc, orderDetail) => {
      const originalOrderDetail = originalOrderDetails.find(od => od.product.id === orderDetail.product.id)
      if (!originalOrderDetail) {
        acc.added.push(this.orderDetailReadToWrite(orderDetail))
      } else {
        if (originalOrderDetail.count !== orderDetail.count) {
          const modifiedDetail: OrderDetailWrite = {
            ...this.orderDetailReadToWrite(originalOrderDetail),
            count: orderDetail.count, // Yeni count değeri
          };
          acc.modified.push(modifiedDetail)
        }
      }
      return acc;

    }, { added: [], modified: [], deletedIds: [] } as
    OrderDetailChanges)

    const mapperIds = new Set(mapperOrderDetails.map(od => od.product.id));
    changes.deletedIds = originalOrderDetails
      .filter(od => !mapperIds.has(od.product.id))
      .map(od => od.id);

    return changes;
  }


  static orderDetailReadToWrite(orderDetail: OrderDetailRead): OrderDetailWrite {
    const { product, ...rest } = orderDetail;
    return {
      ...rest,
      product_id: product.id
    }
  }

}
