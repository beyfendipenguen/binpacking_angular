import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { Observable } from "rxjs";
import { LoadingConstraint, LoadingConstraintDto } from "../interfaces/loading-constraint.interface";

@Injectable({
  providedIn: 'root',
})
export class LoadingConstraintService extends GenericCrudService<LoadingConstraint, string, LoadingConstraintDto, LoadingConstraintDto> {
  constructor(http: HttpClient) {
    super(http, 'logistics/loading-constraints');
  }

  /**
   * Kuralı bir veya birden fazla company relation'da aktive eder.
   * Backend Action: add-relations (POST)
   */
  addRelations(constraintId: string, companyRelationIds: string[]): Observable<LoadingConstraint> {
    this.ensureApiUrl();
    const url = `${this.apiUrl}${constraintId}/add-relations/`;

    const body = {
      company_relation_ids: companyRelationIds
    };

    return this.http.post<LoadingConstraint>(url, body);
  }
}
