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
      weight_category_id: order!.weight_category?.id ?? null,  // weight_type yerine
      name: order!.name,
      max_pallet_height: order!.max_pallet_height,
      truck_weight_limit: order!.truck_weight_limit
    };
    return this.http.post<{ order: Order, created: boolean }>(
      `${this.apiUrl}update-or-create/`, formattedOrder
    );
  }

  reviseOrder(orderId:string){
    this.ensureApiUrl();
    const payload = {
      "id": orderId
    }
    return this.http.post<{message:string}>(`${this.apiUrl}revise-order/`, payload)
  }

  /**
   * Sipariş numarasını değiştirir (PREFIX.NUMBER.RevN → sadece NUMBER).
   * Backend eski rapor dosyalarını silip yeniden üretir.
   * swap=true: hedef numarada başka sipariş varsa iki siparişin
   * numarası takas edilir (her ikisinin raporları yeniden üretilir).
   * Yetki: orders.change_order_number
   */
  changeOrderNumber(orderId: string, newNumber: number, swap: boolean = false) {
    this.ensureApiUrl();
    return this.http.post<{
      status: string;
      message: string;
      old_name: string;
      new_name: string;
      other_old_name?: string;
      other_new_name?: string;
      deleted_files: number;
      created_files: number;
      swapped: boolean;
      order: Order;
    }>(`${this.apiUrl}${orderId}/change-order-number/`, {
      new_number: newNumber,
      swap,
    });
  }
}
