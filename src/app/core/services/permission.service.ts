import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { IPermission, PermissionGroup } from '../interfaces/permission.interface';

@Injectable({
  providedIn: 'root',
})
export class PermissionService extends GenericCrudService<IPermission, number> {
  constructor(http: HttpClient) {
    super(http, 'access_control/permissions');
  }

  /**
   * Permission'ları app'lere göre grupla
   */
  getAllGroupedByApp(): Observable<PermissionGroup[]> {
    return this.getAll().pipe(
      map(response => this.groupPermissionsByApp(response.results))
    );
  }

  private groupPermissionsByApp(permissions: IPermission[]): PermissionGroup[] {
    const grouped = permissions.reduce((acc, permission) => {
      const appLabel = permission.content_type.app_label;
      if (!acc[appLabel]) {
        acc[appLabel] = {
          app_label: appLabel,
          app_name: this.formatAppName(appLabel),
          permissions: []
        };
      }
      acc[appLabel].permissions.push(permission);
      return acc;
    }, {} as { [key: string]: PermissionGroup });

    return Object.values(grouped).sort((a, b) =>
      a.app_name.localeCompare(b.app_name)
    );
  }

  private formatAppName(appLabel: string): string {
    // "order_management" → "Order Management"
    return appLabel
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
