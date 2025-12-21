import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { ICompanyUser } from '../models/company-user-management.interface';
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Injectable({
    providedIn: 'root'
})
export class CompanyUserService extends GenericCrudService<ICompanyUser> {
    constructor(http: HttpClient) {
        super(http, 'access_control/company_users');
    }
}
