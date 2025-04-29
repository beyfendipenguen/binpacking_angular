import { Injectable } from '@angular/core';
import { ProductType } from '../../../models/product-type.interface';
import { GenericCrudService } from '../../../services/generic-crud.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ProductTypeService   extends GenericCrudService<ProductType> {
  constructor(http: HttpClient) {
    super(http, 'products/product-types');
  }
}
