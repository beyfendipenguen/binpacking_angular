import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { FileResponse } from '../interfaces/file-response.interface';
import { mapOrderDetailsToUiProductsSafe, mapToOrderDetailDtoList } from '../../../../models/mappers/order-detail.mapper';
import { mapPackageDetailToPackage, mapPackageToPackageDetail } from '../../../../models/mappers/package-detail.mapper';
import { mapUiPackagesToOrderDetails } from '../../../../models/mappers/ui-package-to-order-detail.mapper';
import { UiPallet } from '../components/ui-models/ui-pallet.model';
import { OrderDetail } from '../../../../models/order-detail.interface';
import { Order } from '../../../../models/order.interface';
import { Truck } from '../../../../models/truck.interface';
import { CompanyRelation } from '../../../../models/company-relation.interface';
import { OrderDetailDiffCalculator } from '../../../../models/utils/order-detail-diff.util';

import { Store } from '@ngrx/store';
import { AppState, updateOrderDetailsChanges } from '../../../../store';
import { selectOrderId, selectOriginalOrderDetails, selectRemainingProducts } from '../../../../store/stepper/stepper.selectors';
import { UiPackage } from '../components/ui-models/ui-package.model';

@Injectable({
  providedIn: 'root',
})
export class RepositoryService {
  private store = inject(Store<AppState>);

  constructor(private api: ApiService, private http: HttpClient) { }

  private getOrderId = this.store.selectSignal(selectOrderId)


  orderDetails(id: string): Observable<any> {
    // api/orders/order-details/{id}/
    // get order detail by order id.
    return this.http
      .get<any>(`${this.api.getApiUrl()}/orders/order-details/?order_id=${id}&limit=100`)
      .pipe(map((response) => { return mapToOrderDetailDtoList(response.results) }));
  }

  orderDetailsOriginal(id: string): Observable<any> {
    // api/orders/order-details/{id}/
    // get order detail by order id.
    return this.http
      .get<any>(`${this.api.getApiUrl()}/orders/order-details/?order_id=${id}`).pipe(map((response) => response.results));
  }

  getPackageDetails(order_id: string = this.getOrderId()): Observable<{ packages: any[], remainingProducts: any[] }> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/package-details/?order_id=${order_id}&limit=100`)
      .pipe(map((response) => ({
        packages: mapPackageDetailToPackage(response.results),
        remainingProducts: mapOrderDetailsToUiProductsSafe(response.remaining_order_details)
      })));
  }

  pallets(): Observable<any> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/pallets/`, {
        params: new HttpParams().set('limit', 30).set('offset', 0),
      })
      .pipe(
        map((response) =>
          response.results.map((item: any) => new UiPallet(item))
        )
      );
  }

  getTrucks(): Observable<any> {
    return this.http.get<Truck>(`${this.api.getApiUrl()}/logistics/trucks/`, {
      params: new HttpParams().set('limit', 30).set('offset', 0),
    });
  }

  companyRelations(company_id: string): Observable<any> {
    return this.http.get<CompanyRelation>(
      `${this.api.getApiUrl()}/logistics/companies/${company_id}/relations/`
    );
  }

  deleteOrderDetail(id: string): Observable<any> {
    // api/orders/order-details/{id}/
    // delete order detail
    return this.http.delete<any>(
      `${this.api.getApiUrl()}/orders/order-details/${id}/`
    );
  }


  uploadFile(file: File, orderId: string, type:string): Observable<FileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('order_id', orderId); // Burada order_id olarak gönderiyoruz
    formData.append('type', type);

    return this.http.post<FileResponse>(
      `${this.api.getApiUrl()}/orders/files/`,
      formData
    );
  }

  processFile(
    file: File
  ): Observable<{ message: string; order: Order; orderDetail: OrderDetail[] }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{
      message: string;
      order: Order;
      orderDetail: OrderDetail[];
    }>(`${this.api.getApiUrl()}/orders/process-file/`, formData);
  }

  calculatePackageDetail(order_id: string = this.getOrderId()): Observable<{ packageDetails: any[], remainingOrderDetails: any[] }> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/calculate-box/${order_id}/`)
      .pipe(map((response) => ({
        packageDetails: mapPackageDetailToPackage(response.data),
        remainingOrderDetails: mapOrderDetailsToUiProductsSafe(response.remaining_order_details)
      })));
  }

  bulkCreatePackageDetail(
    uiPackages: UiPackage[],
    order_id: string = this.getOrderId()
  ) {

    const payload = {
      packageDetails: mapPackageToPackageDetail(uiPackages),
    };
    return this.http.post<any>(
      `${this.api.getApiUrl()}/logistics/create-package-detail/${order_id}/`,
      payload
    );
  }

  /**
   * Bulk Update OrderDetails**
   * Tek bir API çağrısı ile tüm OrderDetail değişikliklerini yap
   */
  bulkUpdateOrderDetails(
    changes: {
      added: OrderDetail[];
      modified: OrderDetail[];
      deleted: OrderDetail[];
    },
    order_id: string = this.getOrderId()
  ): Observable<any> {
    // Deleted array'indeki object'lerin ID'lerini al
    const deletedIds = changes.deleted
      .filter((detail) => detail && detail.id)
      .map((detail) => detail.id);

    const payload = {
      added: changes.added.map((detail) => ({
        product_id: (detail.product && detail.product.id) || detail.product_id,
        count: detail.count,
        unit_price: detail.unit_price || 1,
      })),
      modified: changes.modified.map((detail) => ({
        id: detail.id,
        product_id: (detail.product && detail.product.id) || detail.product_id,
        count: detail.count,
        unit_price: detail.unit_price || 1,
      })),
      deleted: deletedIds,
    };

    return this.http.post<any>(
      `${this.api.getApiUrl()}/orders/${order_id}/bulk-update-order-details/`,
      payload
    );
  }

  createReport(order_id: string = this.getOrderId()): Observable<any> {
    return this.http.get<any>(
      `${this.api.getApiUrl()}/logistics/create-report/${order_id}/`
    );
  }

  calculatePacking(order_id: string = this.getOrderId()) {
    return this.http.get<any>(
      `${this.api.getApiUrl()}/logistics/calculate-packing/${order_id}/`
    );
  }

  createTruckPlacementReport(order_id: string = this.getOrderId()) {
    return this.http.get<any>(
      `${this.api.getApiUrl()}/logistics/create-truck-placement-report/${order_id}/`
    )
  }

  partialUpdateOrderResult(piecesData: any, order_result_id: string = this.getOrderId()) {
    const resultString = JSON.stringify(piecesData);
    const updateData = {
      result: resultString
    };
    return this.http.patch<any>(`${this.api.getApiUrl()}/orders/order-results/${order_result_id}/`, updateData)
  }
}
