import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { Truck } from "../interfaces/truck.interface";

@Injectable({
  providedIn: 'root',
})
export class TruckService extends GenericCrudService<Truck> {
  constructor(http: HttpClient) {
    super(http, 'logistics/trucks');
  }
}
