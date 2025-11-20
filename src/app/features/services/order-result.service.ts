import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { OrderResult } from '../interfaces/order-result.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderResultService extends GenericCrudService<OrderResult> {
  constructor(http: HttpClient) {
    super(http, 'orders/order-results');
  }
}
