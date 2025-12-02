import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { ApiService } from "@core/services/api.service";
import { CompanyRelation } from "@features/interfaces/company-relation.interface";
import { OrderDetailRead } from "@features/interfaces/order-detail.interface";
import { Order } from "@features/interfaces/order.interface";
import { PackageDetail } from "@features/interfaces/package-detail.interface";
import { Pallet } from "@features/interfaces/pallet.interface";
import { Truck } from "@features/interfaces/truck.interface";
import { mapPackageToPackageDetail } from "@features/mappers/package-detail.mapper";
import { AppState, selectOrderId, selectOrderResultId, selectCompanyRelationId } from "@app/store";
import { Store } from "@ngrx/store";
import { Observable, map, switchMap, tap, catchError } from "rxjs";
import { OrderDetailChanges } from "../components/invoice-upload/models/invoice-upload-interfaces";
import { FileResponse } from "../interfaces/file-response.interface";
import { IUiPackage } from "../interfaces/ui-interfaces/ui-package.interface";

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
  ): Observable<{ message: string; order: Order; orderDetail: OrderDetailRead[] }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{
      message: string;
      order: Order;
      orderDetail: OrderDetailRead[];
    }>(`${this.api.getApiUrl()}/orders/process-file/`, formData);
  }

  calculatePackageDetails(verticalSort: boolean, order_id: string = this.getOrderId()): Observable<{ package_details: PackageDetail[] }> {
    const params = new HttpParams().set('vertical_sort', verticalSort.toString());

    return this.http
      .get<any>(`${this.api.getApiUrl()}/logistics/calculate-package-details/${order_id}/`, { params })
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
    changes: {
      added: IUiPackage[],
      modified: IUiPackage[],
      deletedIds: string[]
    },
    orderId: string = this.getOrderId()
  ): Observable<{ package_details: any[] }> {
    console.log('[RepositoryService] bulkUpdatePackageDetails - Başlatılıyor:', {
      addedCount: changes.added.length,
      modifiedCount: changes.modified.length,
      deletedCount: changes.deletedIds.length,
      orderId
    });

    // UiPackage[] → PackageDetail[] mapping
    const addedPackageDetails = mapPackageToPackageDetail(changes.added);
    const modifiedPackageDetails = mapPackageToPackageDetail(changes.modified);


    const payload = {
      added: addedPackageDetails,
      modified: modifiedPackageDetails,
      deletedPackageIds: changes.deletedIds
    };

    console.log('[RepositoryService] bulkUpdatePackageDetails - Payload:', {
      addedDetails: payload.added.length,
      modifiedDetails: payload.modified.length,
      deletedIds: payload.deletedPackageIds.length
    });

    return this.http.post<{ package_details: any[] }>(
      `${this.api.getApiUrl()}/logistics/create-package-detail/${orderId}/`,
      payload
    ).pipe(
      tap(response => {
        console.log('[RepositoryService] bulkUpdatePackageDetails - Response:', {
          packageDetailsCount: response.package_details?.length
        });
      }),
      catchError(error => {
        console.error('[RepositoryService] bulkUpdatePackageDetails - Error:', error);
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
