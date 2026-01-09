import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { ApiService } from "@core/services/api.service";
import { CompanyRelation } from "@features/interfaces/company-relation.interface";
import { OrderDetailRead } from "@features/interfaces/order-detail.interface";
import { Order } from "@features/interfaces/order.interface";
import { PackageDetailWriteDto } from "@features/interfaces/package-detail.interface";
import { Pallet } from "@features/interfaces/pallet.interface";
import { Truck } from "@features/interfaces/truck.interface";
import { AppState, selectOrderId, selectOrderResultId } from "@app/store";
import { Store } from "@ngrx/store";
import { Observable, map, catchError } from "rxjs";
import { OrderDetailChanges } from "../components/invoice-upload/models/invoice-upload-interfaces";
import { FileResponse } from "../interfaces/file-response.interface";
import { PackageReadDto } from "@app/features/interfaces/package.interface";
import { PackageChanges } from "../components/pallet-control/package-changes.helper";
import { PackagePosition } from "@app/features/interfaces/order-result.interface";
import { BaseResponse } from "@app/core/interfaces/base-response.interface";

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
      .pipe(map((response) => response.results));
  }

  orderDetailsOriginal(id: string): Observable<any> {
    // api/orders/order-details/{id}/
    // get order detail by order id.
    return this.http
      .get<any>(`${this.api.getApiUrl()}/orders/order-details/?order_id=${id}`).pipe(map((response) => response.results));
  }

  getPackageDetails(order_id: string = this.getOrderId()): Observable<PackageDetailWriteDto[]> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/package-details/?order_id=${order_id}&limit=100`)
      .pipe(map(response => response.results));
  }

  pallets1(): Observable<any> {
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
      .get<BaseResponse<Pallet>>(`${this.api.getApiUrl()}/logistics/pallets/`, {
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

  getPalletsByCompanyRelation(companyRelationId: string): Observable<Pallet[]> {
    return this.http
      .get<BaseResponse<Pallet>>(`${this.api.getApiUrl()}/logistics/pallets/`, {
        params: new HttpParams()
          .set('limit', 30)
          .set('offset', 0)
          .set('company_relation_id', companyRelationId)
      })
      .pipe(
        map((response) => response.results)
      );
  }

  getTrucks(params?: any): Observable<{ results: Truck[] }> {
    return this.http.get<{ results: Truck[] }>(
      `${this.api.getApiUrl()}/logistics/trucks/`,
      { params: params || {} }
    );
  }

  companyRelations(companyId: string, params?: any): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.api.getApiUrl()}/organizations/companies/${companyId}/relations/`,
      { params: params || {} }
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
  ): Observable<{ message: string; order: Order; orderDetail: OrderDetailRead[] }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{
      message: string;
      order: Order;
      orderDetail: OrderDetailRead[];
    }>(`${this.api.getApiUrl()}/orders/process-file/`, formData);
  }

  calculatePackageDetails(verticalSort: boolean, order_id: string = this.getOrderId()): Observable<{ packages: PackageReadDto[] }> {
    const params = new HttpParams().set('vertical_sort', verticalSort.toString());

    return this.http
      .post<any>(`${this.api.getApiUrl()}/logistics/calculate-packages/${order_id}/`, { params })
      .pipe();
  }

  /**
   * Package değişikliklerini backend'e gönderir ve günceller
   *
   * İş Akışı:
   * 1. UiPackage[] → PackageDetail[] mapping (mevcut mapper kullanılır)
   * 2. Backend'e added, modified, deletedPackageIds gönderilir
   * 3. Backend nested PackageDetailRead response döner
   *
   * @param changes - selectPackageChanges selector'ından gelen değişiklikler
   * @param orderId - Order ID (default: store'daki order)
   * @returns Observable<{ package_details: PackageDetailRead[] }>
   */
  bulkUpdatePackageDetails(
    changes: PackageChanges,
    orderId: string = this.getOrderId()
  ): Observable<{ message: string, packages: PackageReadDto[] }> {

    return this.http.post<{ message: string, packages: PackageReadDto[] }>(
      `${this.api.getApiUrl()}/logistics/bulk-update-package/${orderId}/`,
      {
        added: changes.added,
        modified: changes.modified,
        deletedPackageIds: changes.deletedIds
      }
    ).pipe(
      catchError(error => {
        throw error;
      })
    );
  }

  /**
   * Bulk Update OrderDetails**
   * Tek bir API çağrısı ile tüm OrderDetail değişikliklerini yap
   */
  bulkUpdateOrderDetails(
    changes: OrderDetailChanges,
    order_id: string = this.getOrderId()
  ): Observable<any> {


    return this.http.post<any>(
      `${this.api.getApiUrl()}/orders/${order_id}/bulk-update-order-details/`,
      changes
    );
  }

  createReport(order_id: string): Observable<any> {
    return this.http.post<any>(
      `${this.api.getApiUrl()}/logistics/create-report/${order_id}/`,
      {}
    );
  }

  calculatePacking(order_id: string = this.getOrderId()) {
    return this.http.post<any>(
      `${this.api.getApiUrl()}/logistics/calculate-bin-packing/${order_id}/`,
      {}
    );
  }

  createTruckPlacementReport(order_id: string = this.getOrderId()) {
    return this.http.get<any>(
      `${this.api.getApiUrl()}/logistics/create-truck-placement-report/${order_id}/`
    )
  }

  partialUpdateOrderResult(orderResultId: string, orderResult: PackagePosition[]): Observable<any> {
    const updateData = {
      result: orderResult
    };

    return this.http.patch<any>(
      `${this.api.getApiUrl()}/orders/order-results/${orderResultId}/`,
      updateData
    );
  }
}
