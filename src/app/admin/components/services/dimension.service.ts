import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Dimension } from '../../../models/dimension.interface';
import { GenericCrudService } from '../../../core/services/generic-crud.service';

@Injectable({
  providedIn: 'root'
})
export class DimensionService  extends GenericCrudService<Dimension> {
  constructor(http: HttpClient) {
    super(http, 'products/dimensions');
  }
}
