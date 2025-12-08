import { Directive, Input, isDevMode, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { PERMISSION_FORMAT_REGEX, PermissionType } from './permission.interface';

@Directive({
  selector: '[appHasPermission]'
})
export class HasPermissionDirective {
  private _canPermissions: PermissionType[] = [];
  private _cantPermission: PermissionType[] = [];


  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) { }

  @Input()
  set appHasPermission(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) [
      this.validatePermissions(permissions)
    ]

    this._canPermissions = permissions;
    this.updateView();
  }

  @Input()
  set appHasPermissionCant(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) [
      this.validatePermissions(permissions)
    ]

    this._cantPermission = permissions;
    this.updateView();
  }


  private updateView(): void {
    const isBanned = this.permissionService.hasPermission(this._cantPermission);
    const hasAccess = this.permissionService.hasPermission(this._canPermissions)

    if (!isBanned && hasAccess) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

  private validatePermissions(permissions: PermissionType[]) {
    permissions.forEach(permission => {
      if (!PERMISSION_FORMAT_REGEX.test(permission)) {
        console.error(
          `%c[hasPermissionDirective] Hata: "${permission}" gecerli bir yetki degil!
          Beklenen format: 'app_label.codename' (örn: core.add_order)
          `,
          `color: red; font-weight: bold;`
        );

      }
    })
  }
}
