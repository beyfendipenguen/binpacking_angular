import { Injectable } from '@angular/core';
import { GenericCrudService } from '@core/services/generic-crud.service';
import { HttpClient } from '@angular/common/http';
import { Order } from '@features/interfaces/order.interface';
import { ApiService } from '@core/services/api.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService extends GenericCrudService<Order> {
  constructor(http: HttpClient, api: ApiService) {
    super(http, 'orders/orders');
  }
  createOrder() {
    this.ensureApiUrl();
    return this.http.post<any>(this.apiUrl, {})
  }

  updateOrCreate(order: any) {
    this.ensureApiUrl();

    const formattedOrder = {
      id: order!.id,
      company_relation_id: order!.company_relation?.id,
      truck_id: order!.truck?.id,
      date: order!.date,
      weight_type: order!.weight_type,
      name: order!.name,
      max_pallet_height: order!.max_pallet_height,
      truck_weight_limit: order!.truck_weight_limit
    };
    return this.http.post<{ order: Order, created: boolean }>(`${this.apiUrl}update-or-create/`, formattedOrder)
  }

  reviseOrder(orderId:string){
    this.ensureApiUrl();
    const payload = {
      "id": orderId
    }
    return this.http.post<{message:string}>(`${this.apiUrl}revise-order/`, payload)
  }
}
