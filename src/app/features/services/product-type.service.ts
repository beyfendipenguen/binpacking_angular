import { Injectable } from '@angular/core';
import { ProductType } from '@core/models/product-type.interface';
import { GenericCrudService } from '../../../core/services/generic-crud.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ProductTypeService extends GenericCrudService<ProductType> {
  constructor(http: HttpClient) {
    super(http, 'products/product-types');
  }
}
