import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { ConstraintProfile } from '../interfaces/constraint-profile.interface';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConstraintProfileService extends GenericCrudService<ConstraintProfile> {

  constructor(http: HttpClient) {
    super(http, 'logistics/constraint-profile');
  }
   /**
   * company_relation_id'ye göre constraint profile'ı getirir.
   * Backend tek sonuç döner (OneToOne ilişki).
   */
  getByRelationId(companyRelationId: string): Observable<ConstraintProfile> {
    return this.getAll({ company_relation: companyRelationId }).pipe(
      map(response => {
        if (!response.results?.length) {
          throw new Error(`Constraint profile bulunamadı: ${companyRelationId}`);
        }
        return response.results[0];
      }),
    );
  }
}
