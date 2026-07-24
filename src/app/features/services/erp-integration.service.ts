import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, timer, switchMap, filter, take, timeout } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { SKIP_LOADING } from '@app/shared/loading/skip-loading.token';
import {
  ErpAsyncQueuedResponse,
  ErpCredential,
  ErpCredentialUpdatePayload,
  ErpImportOrderStatus,
  ErpListOrdersStatus,
} from '@features/interfaces/erp-integration.interface';

/**
 * ERP entegrasyonu için servis. GenericCrudService'i extend ETMİYOR —
 * order.service.ts'in aksine burada tek bir CRUD kaynağı yok, iki farklı
 * kök var: kimlik bilgisi (organizations/erp-credential/, CompanyReportProfile
 * ile aynı "tekil kaynak" deseni) ve sipariş listeleme/import (orders/erp/...,
 * bin-packing hesabı/sipariş bölme ile aynı 202+polling deseni — bkz.
 * stepper/services/repository.service.ts).
 */
@Injectable({ providedIn: 'root' })
export class ErpIntegrationService {
  private http = inject(HttpClient);
  private api = inject(ApiService);

  private get baseUrl(): string {
    return this.api.getApiUrl();
  }

  // ───────────────────────── Kimlik bilgisi ─────────────────────────

  getMyCredential(): Observable<ErpCredential> {
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<ErpCredential>(
      `${this.baseUrl}/organizations/erp-credential/mine/`,
      { context }
    );
  }

  updateMyCredential(payload: ErpCredentialUpdatePayload): Observable<ErpCredential> {
    return this.http.patch<ErpCredential>(
      `${this.baseUrl}/organizations/erp-credential/update-mine/`,
      payload
    );
  }

  // ───────────────────────── Sipariş listeleme ─────────────────────────

  requestOrderList(filters: Record<string, any> = {}): Observable<ErpAsyncQueuedResponse> {
    return this.http.post<ErpAsyncQueuedResponse>(
      `${this.baseUrl}/orders/erp/list-orders/`,
      { filters }
    );
  }

  getOrderListStatus(): Observable<ErpListOrdersStatus> {
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<ErpListOrdersStatus>(
      `${this.baseUrl}/orders/erp/list-orders-status/`,
      { context }
    );
  }

  /**
   * ready=true olana kadar list-orders-status'u poll eder.
   * Backend'in soft_time_limit'i 2 dk — 3 dk'da timeout ile vazgeçilir.
   */
  pollOrderList(
    intervalMs: number = 2000,
    timeoutMs: number = 3 * 60 * 1000
  ): Observable<ErpListOrdersStatus> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getOrderListStatus()),
      filter(status => status.ready),
      take(1),
      timeout(timeoutMs)
    );
  }

  // ───────────────────────── Sipariş içeri aktarma ─────────────────────────

  requestImportOrder(orderNumber: string): Observable<ErpAsyncQueuedResponse> {
    return this.http.post<ErpAsyncQueuedResponse>(
      `${this.baseUrl}/orders/erp/import-order/`,
      { order_number: orderNumber }
    );
  }

  getImportOrderStatus(): Observable<ErpImportOrderStatus> {
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<ErpImportOrderStatus>(
      `${this.baseUrl}/orders/erp/import-order-status/`,
      { context }
    );
  }

  /**
   * ready=true olana kadar import-order-status'u poll eder.
   * Backend'in soft_time_limit'i 5 dk — 6 dk'da timeout ile vazgeçilir.
   */
  pollImportOrder(
    intervalMs: number = 2000,
    timeoutMs: number = 6 * 60 * 1000
  ): Observable<ErpImportOrderStatus> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getImportOrderStatus()),
      filter(status => status.ready),
      take(1),
      timeout(timeoutMs)
    );
  }
}
