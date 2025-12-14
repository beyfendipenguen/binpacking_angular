import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { CompanyRelation } from '../interfaces/company-relation.interface';

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
export class CompanyRelationService extends GenericCrudService<CompanyRelation> {
  constructor(http: HttpClient) {
    super(http, 'organizations/company-relations');
  }

  /**
   * Company Relation'ın settings'ini al
   */
  getSettings(relationId: string): Observable<CompanyRelationSettings> {
    this.ensureApiUrl();
    return this.http.get<CompanyRelationSettings>(
      `${this.apiUrl}${relationId}/settings/`
    );
  }

  /**
   * Tüm company relation'ları listele
   */
  getCompanyRelations1(): Observable<any[]> {
    return this.http
      .get<any>(`${this.ensureApiUrl()}`, {
        params: new HttpParams().set('limit', 100).set('offset', 0),
      })
      .pipe(
        map((response) => response.results)
      );
  }
}
