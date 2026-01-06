// has-permission.directive.ts
import { Directive, Input, OnInit, OnChanges, SimpleChanges, TemplateRef, ViewContainerRef, inject, isDevMode } from '@angular/core';
import { PERMISSION_FORMAT_REGEX, PermissionType } from '../../interfaces/permission.interface';
import { Store } from '@ngrx/store';
import { selectUserPermissions } from '@app/store';
import { PermissionDeniedComponent } from '@app/shared/permission-denied/permission-denied.component';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnChanges {
  private _canPermissions: PermissionType[] = [];
  private _cantPermission: PermissionType[] = [];
  private _operator: 'AND' | 'OR' = 'AND';

  // Custom mesaj için
  private _customTitle?: string;
  private _customMessage?: string;
  private _showDetails = true;
  private _showContactButton = true;

  private store = inject(Store);
  private permissions = this.store.selectSignal(selectUserPermissions);

  // View tracking
  private hasCreatedView = false;
  private hasCreatedErrorCard = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
  ) { }

  @Input()
  set appHasPermission(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) {
      this.validatePermissions(permissions);
    }

    this._canPermissions = permissions;
  }

  @Input()
  set appHasPermissionCant(value: PermissionType | PermissionType[]) {
    const permissions = Array.isArray(value) ? value : [value];

    if (isDevMode()) {
      this.validatePermissions(permissions);
    }

    this._cantPermission = permissions;
  }

  @Input()
  set appHasPermissionOperator(value: 'AND' | 'OR') {
    this._operator = value;
  }

  @Input()
  set appHasPermissionTitle(value: string) {
    this._customTitle = value;
  }

  @Input()
  set appHasPermissionMessage(value: string) {
    this._customMessage = value;
  }

  @Input()
  set appHasPermissionShowDetails(value: boolean) {
    this._showDetails = value;
  }

  @Input()
  set appHasPermissionShowContact(value: boolean) {
    this._showContactButton = value;
  }

  ngOnInit(): void {
    this.updateView();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.updateView();
  }

  private hasPermissions(requiredPerms: PermissionType[]): boolean {
    const userPerms = this.permissions();

    if (!requiredPerms || requiredPerms.length === 0) {
      return true;
    }

    if (!userPerms) {
      return false;
    }

    return this._operator === 'AND'
      ? requiredPerms.every(req => userPerms.includes(req))
      : requiredPerms.some(req => userPerms.includes(req));
  }

  private updateView(): void {
    const isBanned = this._cantPermission.length > 0 ? this.hasPermissions(this._cantPermission) : false;
    const hasAccess = this.hasPermissions(this._canPermissions);

    if (!isBanned && hasAccess) {
      if (!this.hasCreatedView) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasCreatedView = true;
        this.hasCreatedErrorCard = false;
      }
    } else {
      if (!this.hasCreatedErrorCard) {
        this.viewContainer.clear();
        const componentRef = this.viewContainer.createComponent(PermissionDeniedComponent);

        componentRef.instance.title = this._customTitle;
        componentRef.instance.message = this._customMessage;
        componentRef.instance.requiredPermissions = this._canPermissions;
        componentRef.instance.restrictedPermissions = this._cantPermission;
        componentRef.instance.showDetails = this._showDetails;
        componentRef.instance.showContactButton = this._showContactButton;
        componentRef.instance.currentPage = window.location.pathname; // Ekledik

        componentRef.changeDetectorRef.detectChanges();

        this.hasCreatedView = false;
        this.hasCreatedErrorCard = true;
      }
    }
  }

  private validatePermissions(permissions: PermissionType[]) {
    permissions.forEach(permission => {
      if (!PERMISSION_FORMAT_REGEX.test(permission)) {
        console.error(
          `%c[hasPermissionDirective] Hata: "${permission}" geçerli bir yetki değil!\nBeklenen format: 'app_label.codename' (örn: core.add_order)`,
          `color: red; font-weight: bold;`
        );
      }
    });
  }
}
