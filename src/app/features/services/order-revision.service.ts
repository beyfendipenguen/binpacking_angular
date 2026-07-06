// features/services/order-revision.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GenericCrudService } from '@core/services/generic-crud.service';
import { OrderRevision, RevisionSummary } from '@features/interfaces/order-revision.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderRevisionService extends GenericCrudService<OrderRevision> {
  constructor(http: HttpClient) {
    // Router kaydına göre ayarla:
    // orders/urls.py → router.register("order-revisions", OrderRevisionView)
    super(http, 'orders/order-revisions');
  }

  /**
   * Sipariş geçmişini getirir.
   * mode verilmezse  → tüm capture adımları (version sırasıyla, diff alanı)
   * mode=transitions → her Rev'in son kaydı (rev_diff = müşteriye gösterilecek fark)
   */
  getRevisions(orderId: string, mode?: 'transitions'): Observable<OrderRevision[]> {
    this.ensureApiUrl();
    const query = mode ? `?mode=${mode}` : '';
    return this.http.get<OrderRevision[]>(
      `${this.apiUrl}${orderId}/revisions/${query}`
    );
  }

  /**
   * İlk hal ↔ son hal tek karşılaştırma özeti (Son Durum görünümü).
   */
  getSummary(orderId: string): Observable<RevisionSummary> {
    this.ensureApiUrl();
    return this.http.get<RevisionSummary>(
      `${this.apiUrl}${orderId}/revisions/?mode=summary`
    );
  }
}