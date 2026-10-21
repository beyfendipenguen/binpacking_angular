import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { WeightCategory } from '../interfaces/weight-category.interface';

@Injectable({
  providedIn: 'root'
})
export class WeightTypeService extends GenericCrudService<WeightCategory> {
  constructor(http: HttpClient) {
    super(http, 'products/weight-types');
  }
}
