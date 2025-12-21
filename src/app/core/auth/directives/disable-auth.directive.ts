import { Directive, ElementRef, inject, Input, isDevMode, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { PERMISSION_FORMAT_REGEX, PermissionType } from '../permission.interface';
import { Store } from '@ngrx/store';
import { selectUserPermissions } from '@app/store';

@Directive({
  selector: '[appDisableAuth], [appDisableAuthCant]',
  standalone: true
})
export class DisableAuthDirective implements OnChanges {
  private _canPermissions: PermissionType[] = [];
  private _cantPermission: PermissionType[] = [];
  private store = inject(Store)

  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  private permissions = this.store.selectSignal(selectUserPermissions)


  constructor() { }
  @Input({ required: false })
  set appDisableAuth(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) {
      this.validatePermissions(permissions);
    }

    this._canPermissions = permissions;
  }

  @Input({ required: false })
  set appDisableAuthCant(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) {
      this.validatePermissions(permissions);
    }

    this._cantPermission = permissions;
  }

  hasPermissions(requiredPerms: PermissionType[]): boolean {
    const userPerms = this.permissions();

    if (!requiredPerms || requiredPerms.length === 0) {
      return true;
    }

    if (!userPerms) {
      return false;
    }

    return requiredPerms.every(req => userPerms.includes(req));
  }

  ngOnChanges(changes: SimpleChanges): void {

    this.updateView();
  }

  private updateView(): void {
    // Referans koddaki mantığın aynısı
    const isBanned = this.hasPermissions(this._cantPermission);
    const hasAccess = this.hasPermissions(this._canPermissions);

    // Eğer yetkili ise (isBanned false VE hasAccess true)
    if (!isBanned && hasAccess) {
      return;
    } else {
      this.disableElement();
    }
  }

  private disableElement() {
    const el = this.elementRef.nativeElement;

    // 1. Native disabled özelliğini set et (Button, Input vb. için)
    this.renderer.setProperty(el, 'disabled', true);

    // 2. Görsel olarak kullanıcıya hissettir (Anchor tag'ler veya div'ler için de çalışır)
    this.renderer.setStyle(el, 'opacity', '0.5');
    this.renderer.setStyle(el, 'cursor', 'not-allowed');
    this.renderer.setStyle(el, 'pointer-events', 'none'); // Tıklamayı CSS ile de engelle

    // 3. Opsiyonel: Kullanıcıya neden tıklayamadığına dair ipucu (Tooltip)
    this.renderer.setAttribute(el, 'title', 'Bu işlem için yetkiniz bulunmamaktadır.');
  }

  /**
   * Elemanı Aktif Hale Getirir (Yetki Gelirse)
   */
  private validatePermissions(permissions: PermissionType[]) {
    permissions.forEach(permission => {
      if (!PERMISSION_FORMAT_REGEX.test(permission)) {
        console.error(
          `%c[DisableAuthDirective] Hata: "${permission}" geçerli bir yetki değil!`,
          `color: red; font-weight: bold;`
        );
      }
    });
  }

}
