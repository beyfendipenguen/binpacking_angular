import { Injectable } from '@angular/core';
import { GenericCrudService } from '../../../core/services/generic-crud.service';
import { CompanyRelation } from '../../../models/company-relation.interface';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface CompanyRelationSettings {
  truck_weight_limit: number;
  max_pallet_height: number;
  max_pallets_per_package: number;
  default_pallet_group_id: string | null;
  weight_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyRelationService extends GenericCrudService<CompanyRelation>{
  constructor(http: HttpClient) {
    super(http, 'orders/company-relations');
  }

  /**
   * Company Relation'ın settings'ini al
   */
  getSettings(relationId: string): Observable<CompanyRelationSettings> {
    return this.http.get<CompanyRelationSettings>(
      `${this.api.getApiUrl()}/orders/company-relations/${relationId}/settings/`
    );
  }

  /**
   * Tüm company relation'ları listele
   */
  getCompanyRelations(): Observable<any[]> {
    return this.http
      .get<any>(`${this.api.getApiUrl()}/orders/company-relations/`, {
        params: new HttpParams().set('limit', 100).set('offset', 0),
      })
      .pipe(
        map((response) => response.results)
      );
  }
}
