import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '../../../core/services/generic-crud.service';
import { Company } from '@core/models/company.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompanyService extends GenericCrudService<Company> {

  constructor(http: HttpClient) {
    super(http, 'orders/companies');
  }

  getTargetCompanies(companyId?: number): Observable<Company[]> {
    const url = companyId
      ? `${this.apiUrl}/${companyId}/target-companies/`
      : `${this.apiUrl}/target-companies/`;
    return this.http.get<Company[]>(url);
  }

  getAllTargetCompanies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${this.apiUrl}/target-companies/`);
  }
}
