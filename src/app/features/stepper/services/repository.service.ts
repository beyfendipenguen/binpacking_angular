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
import { Observable, map, catchError, timer, switchMap, filter, take, timeout } from "rxjs";
import { OrderDetailChanges } from "../components/invoice-upload/models/invoice-upload-interfaces";
import { FileResponse } from "../interfaces/file-response.interface";
import { PackageReadDto } from "@app/features/interfaces/package.interface";
import { PackageChanges } from "../components/pallet-control/package-changes.helper";
import { PackagePosition } from "@app/features/interfaces/order-result.interface";
import { BaseResponse } from "@app/core/interfaces/base-response.interface";
import { LanguageService } from "@app/core/services/language.service";

export interface CalculatePackageResponse {
  message: string;
  packages: PackageReadDto[];
  pending_order_details: OrderDetailRead[];
  reduced_from_params: OrderDetailRead[];
  low_fill_rate_order_details: OrderDetailRead[];
}

export interface CalculationStatus {
  progress: number;
  ready: boolean;
  success: boolean;
  updated_at: string;
  error?: string;
}

export interface SplitShipmentsStatus {
  state: 'queued' | 'done' | 'error';
  ready: boolean;
  new_orders?: { id: string; name: string }[];
  original_order_id?: string;
  original_order_name?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RepositoryService {
  private store = inject(Store<AppState>);
  languageService = inject(LanguageService);
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

  getPalletsByOrder(orderId: string = this.getOrderId()): Observable<any> {
    return this.http
      .get<BaseResponse<Pallet>>(`${this.api.getApiUrl()}/logistics/pallets/`, {
        params: new HttpParams()
          .set('limit', 1000)
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
          .set('limit', 1000)
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

  calculatePackageDetails(
    verticalSort: boolean,
    order_id: string = this.getOrderId(),
    orderDetailParams?: { orderDetailId: string; count: number }[],
    onlyRemainingOrderDetails?: any[]  // ← EKLE
  ): Observable<CalculatePackageResponse> {
    const body: any = { vertical_sort: verticalSort };

    if (orderDetailParams && orderDetailParams.length > 0) {
      body.order_detail_params = orderDetailParams;
    }

    if (onlyRemainingOrderDetails && onlyRemainingOrderDetails.length > 0) {
      body.only_remaining_order_details = onlyRemainingOrderDetails;  // ← EKLE
    }

    return this.http
      .post<CalculatePackageResponse>(`${this.api.getApiUrl()}/logistics/calculate-packages/${order_id}/`, body)
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
    const lang = this.languageService.getCurrentLanguage();
    return this.http.post(`${this.api.getApiUrl()}/logistics/create-report/${order_id}/?lang=${lang}`, {});
  }

  /**
   * Bin packing hesabını kuyruğa atar. Backend 202 + task_id döner;
   * sonuç için pollCalculationStatus ile beklenmeli.
   */
  calculatePacking(multiShipment: boolean = false, order_id: string = this.getOrderId()) {
    return this.http.post<{ status: string; task_id: string; order_id: string }>(
      `${this.api.getApiUrl()}/logistics/calculate-bin-packing/${order_id}/`,
      { multi_shipment: multiShipment }
    );
  }

  getCalculationStatus(order_id: string = this.getOrderId()): Observable<CalculationStatus> {
    return this.http.get<CalculationStatus>(
      `${this.api.getApiUrl()}/logistics/calculate-bin-packing-status/${order_id}/`
    );
  }

  /**
   * ready=true olana kadar status endpoint'ini poll eder.
   * Backend'in soft_time_limit'i 10 dk — 11 dk'da timeout ile vazgeçilir
   * (task crash olur da progress hiç 100 olmazsa sonsuz beklemeyelim).
   */
  pollCalculationStatus(
    order_id: string = this.getOrderId(),
    intervalMs: number = 2500,
    timeoutMs: number = 11 * 60 * 1000
  ): Observable<CalculationStatus> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getCalculationStatus(order_id)),
      filter(status => status.ready),
      take(1),
      timeout(timeoutMs)
    );
  }

  createTruckPlacementReport(order_id: string = this.getOrderId()) {
    return this.http.get<any>(
      `${this.api.getApiUrl()}/logistics/create-truck-placement-report/${order_id}/`
    )
  }

  /**
   * Çoklu sevkiyatlı siparişi tır başına ayrı order'lara böler.
   * Backend 202 + task_id döner; sonuç için pollSplitShipmentsStatus ile beklenmeli.
   * Yetki: orders.split_shipments (backend tarafında kontrol edilir).
   */
  splitShipments(order_id: string = this.getOrderId()) {
    return this.http.post<{ status: string; task_id: string; order_id: string }>(
      `${this.api.getApiUrl()}/orders/orders/${order_id}/split-shipments/`,
      {}
    );
  }

  getSplitShipmentsStatus(order_id: string = this.getOrderId()): Observable<SplitShipmentsStatus> {
    return this.http.get<SplitShipmentsStatus>(
      `${this.api.getApiUrl()}/orders/orders/${order_id}/split-shipments-status/`
    );
  }

  /**
   * ready=true olana kadar split-shipments-status endpoint'ini poll eder.
   * Backend'in soft_time_limit'i 30 dk — 31 dk'da timeout ile vazgeçilir.
   */
  pollSplitShipmentsStatus(
    order_id: string = this.getOrderId(),
    intervalMs: number = 3000,
    timeoutMs: number = 31 * 60 * 1000
  ): Observable<SplitShipmentsStatus> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getSplitShipmentsStatus(order_id)),
      filter(status => status.ready),
      take(1),
      timeout(timeoutMs)
    );
  }

  partialUpdateOrderResult(
    orderResultId: string,
    orderResult: { shipments: { shipment: number; result: any[] }[] }
  ): Observable<any> {

    const payload = {
      result: orderResult
    };

    const url = `${this.api.getApiUrl()}/orders/order-results/${orderResultId}/partial-update-order-result/`;

    return this.http.post<any>(url, payload).pipe(
      map(response => {
        return response;
      }),
      catchError(err => {
        throw err;
      })
    );
  }
}
