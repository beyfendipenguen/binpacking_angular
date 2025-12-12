import { Directive, inject, Input, isDevMode, TemplateRef, ViewContainerRef } from '@angular/core';
import { PERMISSION_FORMAT_REGEX, PermissionType } from './permission.interface';
import { Store } from '@ngrx/store';
import { selectUserPermissions } from '@app/store';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private _canPermissions: PermissionType[] = [];
  private _cantPermission: PermissionType[] = [];
  private store = inject(Store)


  private permissions = this.store.selectSignal(selectUserPermissions)

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
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


  /**
     * "AND" Mantığı (Strict Mode):
     * Kullanıcı, istenen yetkilerin HEPSİNE sahip olmak zorundadır.
     * Örn: ['core.add_order', 'core.view_order'] geldiyse, kullanıcıda ikisi de olmalı.
     */
  hasPermissions(requiredPerms: PermissionType[]): boolean {
    // 1. Kullanıcının yetkilerini al (Store'dan veya servisten gelen string listesi)
    // Örn: ['core.view_order', 'core.add_order', 'auth.view_user']
    const userPerms = this.permissions(); // Veya signal ise: this.permissions()

    // 2. Eğer requiredPerms boşsa veya null ise, "kısıtlama yok" demektir -> İzin Ver
    if (!requiredPerms || requiredPerms.length === 0) {
      return true;
    }

    // 3. Kullanıcının yetkileri henüz yüklenmediyse -> Reddet
    if (!userPerms) {
      return false;
    }

    // 4. KRİTİK NOKTA: 'every' kullanımı
    // "İstenen her bir yetki (req), kullanıcının yetki listesinde var mı?"
    return requiredPerms.every(req => userPerms.includes(req));
  }

  private updateView(): void {
    const isBanned = !this.hasPermissions(this._cantPermission)
    const hasAccess = this.hasPermissions(this._canPermissions)

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
