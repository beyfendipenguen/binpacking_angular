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

  /**
   * Belirtilen Palet Grubuna paletleri ekler.
   * Backend Action: add-pallets (POST)
   */
  addPallets(groupId: string, palletIds: string[]): Observable<PalletGroup> {
    this.ensureApiUrl(); // Bunu ekle
    const url = `${this.apiUrl}${groupId}/add-pallets/`; // endpoint yerine apiUrl

    const body = {
      pallet_ids: palletIds
    };

    return this.http.post<PalletGroup>(url, body);
  }

  /**
   * Belirtilen Palet Grubundan paletleri çıkarır.
   * Backend Action: remove-pallets (POST)
   */
  removePallets(groupId: string, palletIds: string[]): Observable<PalletGroup> {
    this.ensureApiUrl();
    const url = `${this.apiUrl}${groupId}/remove-pallets/`;

    const body = {
      pallet_ids: palletIds
    };

    return this.http.post<PalletGroup>(url, body);
  }
}
