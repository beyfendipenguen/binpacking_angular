// features/services/order-fill-analysis.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GenericCrudService } from '@core/services/generic-crud.service';
import { OrderFillAnalysis } from '@features/interfaces/order-fill-analysis.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderFillAnalysisService extends GenericCrudService<OrderFillAnalysis> {
  constructor(http: HttpClient) {
    // orders/urls.py → router.register("order-fill-analyses", OrderFillAnalysisViewSet)
    super(http, 'orders/order-fill-analyses');
  }

  /** Analizi (yeniden) çalıştırır ve YENİ kaydı döner. */
  analyze(orderId: string): Observable<OrderFillAnalysis> {
    this.ensureApiUrl();
    return this.http.post<OrderFillAnalysis>(`${this.apiUrl}${orderId}/analyze/`, {});
  }

  /** En son kayıt; hiç yoksa null. */
  getLatest(orderId: string): Observable<OrderFillAnalysis | null> {
    this.ensureApiUrl();
    return this.http.get<OrderFillAnalysis | null>(`${this.apiUrl}${orderId}/latest/`);
  }
}
