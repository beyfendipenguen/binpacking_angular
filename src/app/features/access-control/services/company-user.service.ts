import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { ICompanyUser } from '../models/company-user-management.interface';
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class CompanyUserService extends GenericCrudService<ICompanyUser> {
  constructor(http: HttpClient) {
    super(http, 'access_control/company_users');
  }

  addGroups(userId: string, groupIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/add-groups/`, {
      group_ids: groupIds
    });
  }

  removeGroups(userId: string, groupIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/remove-groups/`, {
      group_ids: groupIds
    });
  }

  setGroups(userId: string, groupIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/set-groups/`, {
      group_ids: groupIds
    });
  }
}
