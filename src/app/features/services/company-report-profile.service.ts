import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { CompanyReportProfile } from '../interfaces/report-profile.interface';
import { SKIP_LOADING } from '@app/shared/loading/skip-loading.token';

@Injectable({ providedIn: 'root' })
export class CompanyReportProfileService extends GenericCrudService<CompanyReportProfile> {
  constructor(http: HttpClient) {
    super(http, 'organizations/report-profile');
  }

  getMyProfile(): Observable<CompanyReportProfile> {
    this.ensureApiUrl();
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<CompanyReportProfile>(`${this.apiUrl}my-profile/`, { context });
  }

  updateMyProfile(data: Partial<CompanyReportProfile>): Observable<CompanyReportProfile> {
    this.ensureApiUrl();
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.patch<CompanyReportProfile>(`${this.apiUrl}update-my-profile/`, data, { context });
  }
}
