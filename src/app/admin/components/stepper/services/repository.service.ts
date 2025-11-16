import { inject, Injectable } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, switchMap } from 'rxjs';
import { FileResponse } from '../interfaces/file-response.interface';
import { mapPackageToPackageDetail } from '../../../../models/mappers/package-detail.mapper';
import { OrderDetail } from '../../../../models/order-detail.interface';
import { Order } from '../../../../models/order.interface';
import { Truck } from '../../../../models/truck.interface';
import { CompanyRelation } from '../../../../models/company-relation.interface';

import { Store } from '@ngrx/store';
import { AppState } from '../../../../store';
import { selectCompanyRelationId, selectOrderId, selectOrderResultId } from '../../../../store/stepper/stepper.selectors';
import { UiPackage } from '../components/ui-models/ui-package.model';
import { PackageDetail } from '../../../../models/package-detail.interface';
import { Pallet } from '../../../../models/pallet.interface';
import { IUiPackage } from '../interfaces/ui-interfaces/ui-package.interface';

@Injectable({
  providedIn: 'root',
})
export class RepositoryService {
  private store = inject(Store<AppState>);

  constructor(private api: ApiService, private http: HttpClient) { }

  private getOrderId = this.store.selectSignal(selectOrderId)
  private getOrderResultId = this.store.selectSignal(selectOrderResultId)




  orderDetails(id: string): Observable<any> {
    // api/orders/order-details/{id}/
    // get order detail by order id.
    return this.http
      .get<any>(`${this.api.getApiUrl()}/orders/order-details/?order_id=${id}&limit=100`)
      .pipe(map((response) => response.results));
  }

  orderDetailsOriginal(id: string): Observable<any> {
    // api/orders/order-details/{id}/
    // get order detail by order id.
    return this.http
      .get<any>(`${this.api.getApiUrl()}/orders/order-details/?order_id=${id}`).pipe(map((response) => response.results));
  }

  getPackageDetails(order_id: string = this.getOrderId()): Observable<PackageDetail[]> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/package-details/?order_id=${order_id}&limit=100`)
      .pipe(map(response => response.results));
  }

  pallets(): Observable<any> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/pallets/`, {
        params: new HttpParams().set('limit', 30).set('offset', 0),
      })
      .pipe(
        map((response) =>
          response.results
        )
      );
  }

  getPalletsByOrder(orderId: string = this.getOrderId()): Observable<any> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/pallets/`, {
        params: new HttpParams()
          .set('limit', 30)
          .set('offset', 0)
          .set('order_id', orderId)  // ← Order ID ekle
      })
      .pipe(
        map((response) =>
          response.results
        )
      );
  }

  getPalletsByCompanyRelation(): Observable<Pallet[]> {
    return this.store.select(selectCompanyRelationId).pipe(
      switchMap((companyRelationId) => {
        return this.http
          .get<any>(`${this.api.getApiUrl()}/logistics/pallets/`, {
            params: new HttpParams()
              .set('limit', 30)
              .set('offset', 0)
              .set('company_relation_id', companyRelationId)  // ← Relation ID ekle
          })
          .pipe(
            map((response) =>
              response.results
            )
          )
      })
    )
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


  uploadFile(file: File, orderId: string, type: string): Observable<FileResponse> {
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

  calculatePackageDetails(verticalSort: boolean, order_id: string = this.getOrderId()): Observable<{ package_details: PackageDetail[] }> {
    const params = new HttpParams().set('vertical_sort', verticalSort.toString());

    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/calculate-package-details/${order_id}/`, { params })
      .pipe();
  }

  bulkCreatePackageDetail(
    uiPackages: IUiPackage[],
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
      `${this.api.getApiUrl()}/logistics/calculate-bin-packing/${order_id}/`
    );
  }

  createTruckPlacementReport(order_id: string = this.getOrderId()) {
    return this.http.get<any>(
      `${this.api.getApiUrl()}/logistics/create-truck-placement-report/${order_id}/`
    )
  }

  partialUpdateOrderResult(piecesData: any, order_id: string = this.getOrderResultId()) {
    const updateData = {
      result: piecesData
    };
    return this.http.patch<any>(`${this.api.getApiUrl()}/orders/order-results/${order_id}/`, updateData)
  }
}
