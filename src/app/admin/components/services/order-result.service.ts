import { Injectable } from '@angular/core';
import { OrderResult } from '../../../models/order-result.interface';
import { GenericCrudService } from '../../../core/services/generic-crud.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class OrderResultService  extends GenericCrudService<OrderResult> {
  constructor(http: HttpClient) {
    super(http, 'orders/order-results');
  }
}
