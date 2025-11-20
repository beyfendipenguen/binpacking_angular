import { Injectable } from '@angular/core';
import { GenericCrudService } from '@core/services/generic-crud.service';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin, switchMap } from 'rxjs';
import { OrderDetailRead } from '@features/interfaces/order-detail.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderDetailService extends GenericCrudService<OrderDetailRead> {
  constructor(http: HttpClient) {
    super(http, 'orders/order-details');
  }
  /**
   * Belirli bir order'a ait tüm OrderDetail'leri getir
   */
  getByOrderId(orderId: string): Observable<OrderDetailRead[]> {
    return this.getAll({ order_id: orderId, limit: 100 }).pipe(
      map((response: any) => response.results || [])
    );
  }

  /**
   * OrderDetail'i order_id ile birlikte oluştur
   */
  createWithOrderId(orderDetail: Partial<OrderDetailRead>, orderId: string): Observable<OrderDetailRead> {
    const data = {
      ...orderDetail,
      order_id: orderId
    };
    return this.create(data);
  }

  /**
   * Bulk OrderDetail silme (eğer gerekirse)
   */
  bulkDelete(orderDetailIds: string[]): Observable<any> {
    // Her birini ayrı ayrı sil
    const deleteOperations = orderDetailIds.map(id => this.delete(id));

    // Tüm silme operasyonlarını paralel çalıştır
    return forkJoin(deleteOperations);
  }

  /**
   * Order'a ait tüm OrderDetail'leri sil
   */
  deleteByOrderId(orderId: string): Observable<any> {
    return this.getByOrderId(orderId).pipe(
      switchMap((orderDetails: OrderDetailRead[]) => {
        const deleteOperations = orderDetails.map(detail => this.delete(detail.id));
        return forkJoin(deleteOperations);
      })
    );
  }
}
