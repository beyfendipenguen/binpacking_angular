import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { Observable } from 'rxjs';
import { Company } from '../interfaces/company.interface';

@Injectable({
  providedIn: 'root'
})
export class CompanyService extends GenericCrudService<Company> {

  constructor(http: HttpClient) {
    super(http, 'organizations/companies');
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

  getAvailableCompanies(search?: string): Observable<any> {
    this.ensureApiUrl();
    const params: any = {};
    if (search) params['search'] = search;
    return this.http.get(`${this.apiUrl}available_invoice_companies/`, { params });
  }
}
