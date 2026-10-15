// features/services/order-feedback.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '@app/shared/loading/skip-loading.token';
import { Observable } from 'rxjs';
import { GenericCrudService } from '@core/services/generic-crud.service';
import { FeedbackPayload, FeedbackStatus, OrderFeedback } from '@features/interfaces/order-feedback.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderFeedbackService extends GenericCrudService<any> {
  /**
   * Ekran görüntüsünü üreten fonksiyon (3D bileşeni kayıt eder). Servis
   * üzerinden paylaşılır; çıkış guard'ı ve dialog bileşeni bileşenlere
   * doğrudan bağlanmadan kullanabilir.
   */
  screenshotProvider: (() => string | null) | null = null;
  /** Ekrandaki son yerleşimi ({ shipments }) veren fonksiyon (result-step kayıt eder). */
  resultProvider: (() => Promise<{ shipments: any[] } | null>) | null = null;

  constructor(http: HttpClient) {
    // orders/urls.py → router.register("order-revisions", OrderRevisionViewSet)
    super(http, 'orders/order-revisions');
  }

  /**
   * @param silent true ise global yükleme göstergesi açılmaz (arka plan
   * sorguları: beğen/beğenme durumu gibi).
   */
  getStatus(orderId: string, silent = false): Observable<FeedbackStatus> {
    this.ensureApiUrl();
    const context = new HttpContext().set(SKIP_LOADING, silent);
    return this.http.get<FeedbackStatus>(`${this.apiUrl}${orderId}/feedback-status/`, { context });
  }

  submit(orderId: string, payload: FeedbackPayload, silent = false): Observable<{ feedback: OrderFeedback; version: number; has_screenshot: boolean }> {
    this.ensureApiUrl();
    const context = new HttpContext().set(SKIP_LOADING, silent);
    return this.http.post<{ feedback: OrderFeedback; version: number; has_screenshot: boolean }>(
      `${this.apiUrl}${orderId}/feedback/`, payload, { context }
    );
  }
}
