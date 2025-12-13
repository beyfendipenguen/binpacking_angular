import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { Dimension } from '../interfaces/dimension.interface';

@Injectable({
  providedIn: 'root'
})
export class DimensionService extends GenericCrudService<Dimension> {
  constructor(http: HttpClient) {
    super(http, 'products/dimensions');
  }
}
