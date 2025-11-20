import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { WeightType } from '../../../models/weight-type.interface';
import { GenericCrudService } from '../../../core/services/generic-crud.service';

@Injectable({
  providedIn: 'root'
})
export class WeightTypeService extends GenericCrudService<WeightType>  {
  constructor(http: HttpClient) {
    super(http, 'products/weight-types');
  }
}
