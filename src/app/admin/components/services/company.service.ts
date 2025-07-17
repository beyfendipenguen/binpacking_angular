import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '../../../services/generic-crud.service';
import { Company } from '../../../models/company.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompanyService extends GenericCrudService<Company> {

  constructor(http: HttpClient) {
    super(http, 'companys/companys');
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
