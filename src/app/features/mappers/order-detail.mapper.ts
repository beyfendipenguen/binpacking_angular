import { OrderDetailRead } from "../interfaces/order-detail.interface";
import { UiProduct } from "../stepper/components/ui-models/ui-product.model";

/**
 * OrderDetail'i UiProduct'a map eder
 * @param orderDetail - Map edilecek OrderDetail objesi
 * @returns UiProduct instance'ı
 */
export function mapOrderDetailToUiProduct(orderDetail: OrderDetailRead): UiProduct {
  return new UiProduct({
    id: orderDetail.id,
    name: orderDetail.product.name,
    count: orderDetail.count,
    product_type: orderDetail.product.product_type,
    dimension: orderDetail.product.dimension,
    weights: orderDetail.product.weights,  // weight_type → weights
    company: orderDetail.product.company
  });
}


/**
 * OrderDetail array'ini UiProduct array'ine map eder
 * @param orderDetails - Map edilecek OrderDetail array'i
 * @returns UiProduct array'i
 */
export function mapOrderDetailsToUiProducts(orderDetails: OrderDetailRead[]): UiProduct[] {
  if (!orderDetails || !Array.isArray(orderDetails)) {
    return [];
  }

  return orderDetails.map(orderDetail => mapOrderDetailToUiProduct(orderDetail));
}

/**
 * Güvenli mapping - hata kontrolü ile
 * @param orderDetails - Map edilecek OrderDetail array'i
 * @returns UiProduct array'i (hatalı olanlar filtrelenir)
 */
export function mapOrderDetailsToUiProductsSafe(orderDetails: OrderDetailRead[]): UiProduct[] {
  if (!orderDetails || !Array.isArray(orderDetails)) {
    return [];
  }

  return orderDetails
    .filter(orderDetail => {
      return orderDetail &&
        orderDetail.id &&
        orderDetail.product &&
        orderDetail.product.product_type &&
        orderDetail.product.dimension &&
        orderDetail.product.weights &&  // weight_type → weights
        typeof orderDetail.count === 'number';
    })
    .map(orderDetail => {
      try {
        return mapOrderDetailToUiProduct(orderDetail);
      } catch (error) {
        return null;
      }
    })
    .filter(product => product !== null) as UiProduct[];
}
