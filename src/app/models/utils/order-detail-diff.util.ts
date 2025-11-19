import { UiProduct } from "../../admin/components/stepper/components/ui-models/ui-product.model";
import { OrderDetailRead, OrderDetailWrite } from "../order-detail.interface";
import { Product } from "../product.interface";
import { OrderDetailChanges } from "../../admin/components/stepper/components/invoice-upload/models/invoice-upload-interfaces";


export class OrderDetailDiffCalculator {

  /**
   * mapperOrderDetails ile originalOrderDetails'i karşılaştırır
   * ve added, modified, deleted değişikliklerini döner
   * 
   */
  static calculateDiff(
    mapperOrderDetails: OrderDetailRead[],
    originalOrderDetails: OrderDetailRead[],
    remainingProducts: UiProduct[]
  ): OrderDetailChanges {

    let mergedRemainingProducts = remainingProducts.reduce((acc, product) => {
      if (!acc.some(p => p.id === product.id)) {
        acc.push(product);
      } else {
        const existingProduct = acc.find(p => p.id === product.id);
        if (existingProduct) {
          existingProduct.count += product.count;
        }
      }
      return acc;
    }, [] as UiProduct[]);


    mapperOrderDetails.map(orderDetail => {
      const remainingProduct = mergedRemainingProducts.find(p => p.id === orderDetail.product.id)
      return remainingProduct ? { ...orderDetail, count: orderDetail.count + remainingProduct.count } : orderDetail
    });

    mergedRemainingProducts.forEach(product => {
      if (!mapperOrderDetails.some(orderDetail => orderDetail.product.id === product.id)) {
        mapperOrderDetails.push({
          id: "",
          count: product.count,
          unit_price: "1",
          remaining_count: 0,
          product: product as Product,
          order_id: ""
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
