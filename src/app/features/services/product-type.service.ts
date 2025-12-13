import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { ProductType } from '../interfaces/product-type.interface';

@Injectable({
  providedIn: 'root'
})
export class ProductTypeService extends GenericCrudService<ProductType> {
  constructor(http: HttpClient) {
    super(http, 'products/product-types');
  }
}
