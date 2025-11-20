import { Injectable } from '@angular/core';
import { GenericCrudService } from '../../../core/services/generic-crud.service';
import { HttpClient } from '@angular/common/http';
import { PackageDetail } from '../../../models/package-detail.interface';

@Injectable({
  providedIn: 'root'
})
export class PackageDetailService  extends GenericCrudService<PackageDetail> {
  constructor(http: HttpClient) {
    super(http, 'logistics/package-details');
  }
}
