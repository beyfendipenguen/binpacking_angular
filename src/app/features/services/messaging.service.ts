import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { SKIP_LOADING } from '@app/shared/loading/skip-loading.token';
import {
  AppNotification,
  ChatMessage,
  ConversationSummary,
  MessagingSummary,
  PagedResponse,
} from '@features/interfaces/messaging.interface';

/**
 * Bildirim + mesajlaşma API istemcisi (/api/messaging/...).
 * GenericCrudService'ten kasıtlı olarak türetilmedi: o servis sayısal görünen
 * metinleri ("123") sayıya çevirir; mesaj gövdesi olduğu gibi kalmalı.
 */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  private url(path: string): string {
    return `${this.api.getApiUrl()}/messaging/${path}`;
  }

  /** Arka plan sorguları global yükleme göstergesini açmasın. */
  private silent(silent: boolean): { context: HttpContext } {
    return { context: new HttpContext().set(SKIP_LOADING, silent) };
  }

  getSummary(): Observable<MessagingSummary> {
    return this.http.get<MessagingSummary>(this.url('summary/'), this.silent(true));
  }

  getNotifications(limit = 30, offset = 0): Observable<PagedResponse<AppNotification>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<PagedResponse<AppNotification>>(this.url('notifications/'), {
      params,
      ...this.silent(true),
    });
  }

  markNotificationRead(id: string): Observable<AppNotification> {
    return this.http.post<AppNotification>(this.url(`notifications/${id}/read/`), {}, this.silent(true));
  }

  markAllNotificationsRead(): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(this.url('notifications/read-all/'), {}, this.silent(true));
  }

  getConversations(silent = true): Observable<ConversationSummary[]> {
    return this.http.get<ConversationSummary[]>(this.url('conversations/'), this.silent(silent));
  }

  getMessages(peer: string, limit = 100, silent = true): Observable<ChatMessage[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<ChatMessage[]>(this.url(`conversations/${peer}/messages/`), {
      params,
      ...this.silent(silent),
    });
  }

  sendMessage(peer: string, body: string, image?: File | null): Observable<ChatMessage> {
    const url = this.url(`conversations/${peer}/messages/`);
    if (image) {
      const form = new FormData();
      form.append('body', body);
      form.append('image', image, image.name);
      return this.http.post<ChatMessage>(url, form, this.silent(true));
    }
    return this.http.post<ChatMessage>(url, { body }, this.silent(true));
  }

  markConversationRead(peer: string): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(this.url(`conversations/${peer}/read/`), {}, this.silent(true));
  }
}
