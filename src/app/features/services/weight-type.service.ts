import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { WeightType } from '../interfaces/weight-type.interface';

@Injectable({
  providedIn: 'root'
})
export class WeightTypeService extends GenericCrudService<WeightType> {
  constructor(http: HttpClient) {
    super(http, 'products/weight-types');
  }
}
