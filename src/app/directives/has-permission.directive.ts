import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../core/services/permission.service';
import { IRequiredPermission } from '../interfaces/permission.interface';

@Directive({
  selector: '[appHasPermission]'
})
export class HasPermissionDirective implements OnInit {
  @Input() canPermissions: IRequiredPermission[] = [];
  @Input() cantPermission: IRequiredPermission[] = [];


  constructor(private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) { }

  ngOnInit(): void {
    if (!this.permissionService.hasPermission(this.cantPermission)) {
      if (this.permissionService.hasPermission(this.canPermissions))
        this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }

}
