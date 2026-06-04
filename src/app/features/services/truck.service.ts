import { HttpClient, HttpContext } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { Truck } from "../interfaces/truck.interface";
import { Observable } from "rxjs";
import { SKIP_LOADING } from "@app/shared/loading/skip-loading.token";

@Injectable({
  providedIn: 'root',
})
export class TruckService extends GenericCrudService<Truck> {
  constructor(http: HttpClient) {
    super(http, 'logistics/trucks');
  }

  checkUsage(id: string): Observable<{ in_use: boolean; orders: { id: string; name: string }[] }> {
    this.ensureApiUrl();
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<any>(`${this.apiUrl}${id}/check-usage/`, { context });
  }
}
