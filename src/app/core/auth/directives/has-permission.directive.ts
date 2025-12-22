import { Directive, ElementRef, inject, Input, isDevMode, OnChanges, SimpleChanges, TemplateRef, ViewContainerRef } from '@angular/core';
import { PERMISSION_FORMAT_REGEX, PermissionType } from '../permission.interface';
import { Store } from '@ngrx/store';
import { selectUserPermissions } from '@app/store';
import { InfoCardComponent } from '@app/shared/info-card/info-card.component';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnChanges {
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
  }

  @Input()
  set appHasPermissionCant(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) [
      this.validatePermissions(permissions)
    ]

    this._cantPermission = permissions;
  }


  ngOnChanges(changes: SimpleChanges): void {
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
    const isBanned = this._cantPermission.length > 0 ? this.hasPermissions(this._cantPermission) : false
    const hasAccess = this.hasPermissions(this._canPermissions)

    if (!isBanned && hasAccess) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
      const componentRef = this.viewContainer.createComponent(InfoCardComponent)
      componentRef.instance.header = "YETKI BULUNAMADI!"
      componentRef.instance.title = "Bu Icerigi Goruntulemek Icin Yeterli Yetkiye sahip Degilsiniz!"
      componentRef.instance.content = `
        <strong>Bu yetkilere sahip olmanız gerekir: </strong> ${this._canPermissions.join(', ')} <br><br>
        <strong> Bu yetki kısıtlamalarını kaldırmanız gerekmektedir: </strong> ${this._cantPermission.join(', ')} <br><br>
        <em> Lütfen yöneticiniz ile görüşün.</em>`
      componentRef.changeDetectorRef.detectChanges()

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
