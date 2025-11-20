import { UiProduct } from "../../admin/components/stepper/components/ui-models/ui-product.model";
import { IInvoiceOrderDetail } from "../component-models/invoice-order-detail.interface";
import { OrderDetailRead } from "../order-detail.interface";

export const mapToOrderDetailDto = (orderDetail: OrderDetailRead): IInvoiceOrderDetail => {
  const width = Number(orderDetail.product.dimension.width);
  const depth = Number(orderDetail.product.dimension.depth);
  const count = Number(orderDetail.count);
  const meter = (depth * count) / 1000; // Convert to square meters
  const type = orderDetail.product.product_type.type;
  const code = orderDetail.product.product_type.code;
  const id = orderDetail.id;
  return {
    id,
    type,
    code,
    width,
    depth,
    count,
    meter,
  };
};

export const mapToOrderDetailDtoList = (orderDetails: OrderDetailRead[]): IInvoiceOrderDetail[] =>
  orderDetails.map(mapToOrderDetailDto);


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
    weight_type: orderDetail.product.weight_type,
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
      // Gerekli alanların kontrolü
      return orderDetail &&
        orderDetail.id &&
        orderDetail.product &&
        orderDetail.product.product_type &&
        orderDetail.product.dimension &&
        orderDetail.product.weight_type &&
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
