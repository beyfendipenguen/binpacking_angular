import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { Observable } from "rxjs";
import { PalletSelectionRule, PalletSelectionRuleDto } from "../interfaces/pallet-selection-rule.interface";

@Injectable({
  providedIn: 'root',
})
export class PalletSelectionRuleService extends GenericCrudService<PalletSelectionRule, string, PalletSelectionRuleDto, PalletSelectionRuleDto> {
  constructor(http: HttpClient) {
    super(http, 'logistics/pallet-selection-rules');
  }

  /**
   * Kuralı bir veya birden fazla company relation'da aktive eder.
   * Backend Action: add-relations (POST)
   */
  addRelations(ruleId: string, companyRelationIds: string[]): Observable<PalletSelectionRule> {
    this.ensureApiUrl();
    const url = `${this.apiUrl}${ruleId}/add-relations/`;

    const body = {
      company_relation_ids: companyRelationIds
    };

    return this.http.post<PalletSelectionRule>(url, body);
  }
}
