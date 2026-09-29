import { Component, ViewChild, Input, inject, computed } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSidenav, MatSidenavContent, MatSidenavModule } from '@angular/material/sidenav';
import { MatDrawerMode } from '@angular/material/sidenav';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatListModule } from "@angular/material/list";
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { INavListItem } from './inav-list-item';
import { filter } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { AppState, selectUser } from '@app/store';
import ADMIN_ROUTES from '@app/features/admin.routes';

// Her rotanın gerektirdiği yetkiyi admin.routes.ts'teki `data.permission` /
// `data.permissions`'tan TÜRETİR — sidenav ile route guard (permissionGuard)
// arasında manuel senkron tutmak yerine TEK kaynaktan (admin.routes.ts)
// besleniyor. Böylece bir route'un yetkisi değişince sidenav otomatik
// güncel kalır.
const ROUTE_PERMISSIONS: Record<string, string[]> = {};
ADMIN_ROUTES.forEach(route => {
  const raw = route.data?.['permission'] ?? route.data?.['permissions'];
  if (!raw) return;
  ROUTE_PERMISSIONS[route.path ?? ''] = Array.isArray(raw) ? raw : [raw];
});

const NAV_LIST_ITEM: INavListItem[] = [
  {
    routerLink: [''],
    title: 'MENU.PLACEMENT_CALCULATION',
    icon: 'calculate'
  },
  {
    title: 'MENU.OPERATIONS',
    icon: 'pending_actions',
    children: [
      {
        routerLink: ['/orders'],
        title: 'MENU.ORDER_MANAGEMENT',
        icon: 'assignment'
      },
      {
        routerLink: ['/products'],
        title: 'PRODUCT.TITLE',
        icon: 'inventory_2'
      },
      {
        routerLink: ['/pallets'],
        title: 'PALLET.TITLE',
        icon: 'view_module',
      },
      {
        routerLink: ['/trucks'],
        title: 'TRUCK.TITLE',
        icon: 'local_shipping'
      },
      {
        routerLink: ['/customers'],
        title: 'CUSTOMER.TITLE',
        icon: 'assignment_ind'
      },
      {
        routerLink: ['/permissions'],
        title: 'MENU.PERMISSION_MANAGEMENT',
        icon: 'lock_person'
      },
      {
        routerLink: ['/stats'],
        title: 'STATS.STATS_MANAGEMENT',
        icon: 'query_stats'
      },
      {
        routerLink: ['/integration'],
        title: 'INTEGRATION.TITLE',
        icon: 'sync_alt'
      },
    ]
  }
];

@Component({
  selector: 'app-sidenav',
  standalone: true,
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss'],
  imports: [
    MatListModule,
    MatDividerModule,
    MatButtonModule,
    MatSidenavModule,
    MatSidenavContent,
    RouterModule,
    MatIconModule,
    CommonModule,
    TranslateModule
  ]
})
export class SidenavComponent {

  @Input('mode') sidenavMode!: MatDrawerMode;
  @Input() isOpen!: boolean;
  @ViewChild('sidenav', { static: true, read: MatSidenav }) sidenav!: MatSidenav;

  private store = inject(Store<AppState>);
  private user = this.store.selectSignal(selectUser);

  // Kullanıcının yetkisi olmayan menü öğeleri (ve alt öğesi kalmayan
  // üst gruplar) listede HİÇ gösterilmez. Doğrudan URL ile girilirse
  // zaten permissionGuard 'yetki yok' ekranına yönlendiriyor — bu iki
  // mekanizma aynı ROUTE_PERMISSIONS kaynağını (admin.routes.ts) kullanır.
  navItems = computed(() => this.filterByPermission(NAV_LIST_ITEM));

  expandedItems: Set<string> = new Set();
  currentUrl: string = '';

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentUrl = event.url;
      // Auto-expand parent if child is active
      this.autoExpandActive();
    });
  }

  toggleExpand(title: string): void {
    if (this.expandedItems.has(title)) {
      this.expandedItems.delete(title);
    } else {
      this.expandedItems.add(title);
    }
  }

  isExpanded(title: string): boolean {
    return this.expandedItems.has(title);
  }

  open() {
    this.sidenav.open();
  }

  close() {
    this.sidenav.close();
  }

  isActive(node: INavListItem): boolean {
    if (!node.routerLink) return false;
    const routePath = '/' + node.routerLink.join('/');
    return this.currentUrl === routePath || this.currentUrl.startsWith(routePath + '/');
  }

  hasChildren(node: INavListItem): boolean {
    return !!node.children && node.children.length > 0;
  }

  // ROUTE_PERMISSIONS'tan (admin.routes.ts) bir routerLink'in gerektirdiği
  // yetkileri bulur. Eşleşme yoksa (örn. bir üst grup öğesinin kendi rotası
  // yoktur) undefined döner — undefined = kısıtlama yok.
  private permissionForRouterLink(routerLink?: string[]): string[] | undefined {
    if (!routerLink) return undefined;
    const path = routerLink.join('/').replace(/^\/+/, '');
    return ROUTE_PERMISSIONS[path];
  }

  private hasAccess(requiredPermissions?: string[]): boolean {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const user = this.user();
    if (!user) return false;
    if (user.is_superuser) return true;

    return requiredPermissions.some(perm => user.permissions?.includes(perm));
  }

  // Ağacı rekürsif filtreler: yetkisi olmayan yapraklar elenir, tüm alt
  // öğeleri elenen üst gruplar da (kendi rotası olmadığından) gösterilmez.
  private filterByPermission(items: INavListItem[]): INavListItem[] {
    return items.reduce<INavListItem[]>((visible, item) => {
      if (!this.hasAccess(this.permissionForRouterLink(item.routerLink))) {
        return visible;
      }

      if (item.children && item.children.length > 0) {
        const visibleChildren = this.filterByPermission(item.children);
        if (visibleChildren.length === 0) {
          return visible;
        }
        visible.push({ ...item, children: visibleChildren });
        return visible;
      }

      visible.push(item);
      return visible;
    }, []);
  }

  // Auto-expand parent menus when child is active
  private autoExpandActive(): void {
    this.navItems().forEach(item => {
      if (item.children) {
        const hasActiveChild = this.checkActiveChildren(item.children);
        if (hasActiveChild) {
          this.expandedItems.add(item.title);
        }
      }
    });
  }

  private checkActiveChildren(children: INavListItem[]): boolean {
    return children.some(child => {
      if (this.isActive(child)) return true;
      if (child.children) {
        const hasActiveGrandchild = this.checkActiveChildren(child.children);
        if (hasActiveGrandchild) {
          this.expandedItems.add(child.title);
        }
        return hasActiveGrandchild;
      }
      return false;
    });
  }
}
