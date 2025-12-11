import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { Observable } from "rxjs";
import { PalletGroup } from "../interfaces/pallet-group.interface";

@Injectable({
  providedIn: 'root',
})
export class PalletGroupService extends GenericCrudService<PalletGroup> {
  constructor(http: HttpClient) {
    super(http, 'logistics/pallet-groups');
  }
}
