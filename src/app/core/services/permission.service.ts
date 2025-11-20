import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { HttpClient } from '@angular/common/http';
import { IRequiredPermission, IPermission } from '@core/interfaces/permission.interface';
import { isEquelPermissions } from '../utils/pagination.utils';
import { firstValueFrom } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  private userPermissions: IPermission[] = []

  constructor(private apiService: ApiService, private http: HttpClient) { }

  loadPermissions() {
    const url = `${this.apiService.getApiUrl()}/permissions/user_permissions/current_user/`
    return new Promise<void>((resolve, reject) => {
      firstValueFrom(this.http.get<any>(url)).then((response: any) => {
        this.userPermissions = response;
        resolve();
      }).catch((reason => {
        reject(`Could not load file '${url}': ${JSON.stringify(reason)}`);
      }))
    })
  }


  hasPermission(requiredPermission: IRequiredPermission[]): boolean {
    if (requiredPermission.length > this.userPermissions.length) return false;
    let isApproved: boolean = true;
    requiredPermission.forEach(requiredPermission => {
      let hasPermission: boolean = false;
      this.userPermissions.forEach(userPermission => {
        if (isEquelPermissions(userPermission, requiredPermission)) {
          hasPermission = true;
          return;
        }
      });
      if (!hasPermission) {
        isApproved = false;
        return;
      }
    })
    return isApproved;
  }
}
