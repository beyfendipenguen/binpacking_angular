import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { Observable } from "rxjs";
import { BulkUploadResponse, Pallet } from "../interfaces/pallet.interface";

@Injectable({
  providedIn: 'root',
})
export class PalletService extends GenericCrudService<Pallet> {
  constructor(http: HttpClient) {
    super(http, 'logistics/pallets');
  }

  bulkUpload(file: File): Observable<BulkUploadResponse> {
    this.ensureApiUrl();
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<BulkUploadResponse>(
      `${this.apiUrl}bulk-upload/`,
      formData
    );
  }
}
