import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { OrderResult } from '../interfaces/order-result.interface';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderResultService extends GenericCrudService<OrderResult> {
  constructor(http: HttpClient) {
    super(http, 'orders/order-results');
  }

  getByOrderId(orderId: string): Observable<OrderResult[]> {
    return this.getAll({ order_id: orderId, limit: 100 }).pipe(
      map((response: any) => {
        return response.results || [];
      })
    );
  }
}
