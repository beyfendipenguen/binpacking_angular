import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { PackageDetail } from "../interfaces/package-detail.interface";

@Injectable({
  providedIn: 'root'
})
export class PackageDetailService extends GenericCrudService<PackageDetail> {
  constructor(http: HttpClient) {
    super(http, 'logistics/package-details');
  }
}
