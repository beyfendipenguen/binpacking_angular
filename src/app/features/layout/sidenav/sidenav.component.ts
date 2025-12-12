import { Component, ViewChild, Input } from '@angular/core';
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

const NAV_LIST_ITEM: INavListItem[] = [
  {
    routerLink: [''],
    title: 'Yerleştirme Hesaplama',
    icon: 'calculate'
  },
  {
    title: 'İşlemler',
    icon: 'pending_actions',
    children: [
      {
        routerLink: ['/orders'],
        title: 'Sipariş Yönetimi',
        icon: 'assignment'
      },
      {
        routerLink: ['/products'],
        title: 'Ürün Yönetimi',
        icon: 'inventory_2'
      },
      {
        routerLink: ['/pallets'],
        title: 'Palet Yönetimi',
        icon: 'view_module',
      },
      {
        routerLink: ['/trucks'],
        title: 'Sevkiyat Aracı Yönetimi',
        icon: 'local_shipping'
      },
      {
        routerLink: ['/customers'],
        title: 'Müşteri Yönetimi',
        icon: 'assignment_ind'
      },
      {
        routerLink: ['/permissions'],
        title: 'Yetki Yönetimi',
        icon: 'lock_person'
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
    CommonModule
  ]
})
export class SidenavComponent {
  @Input('mode') sidenavMode!: MatDrawerMode;
  @Input() isOpen!: boolean;
  @ViewChild('sidenav', { static: true, read: MatSidenav }) sidenav!: MatSidenav;

  navItems = NAV_LIST_ITEM;
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

  isActive(node: INavListItem): boolean {
    if (!node.routerLink) return false;
    const routePath = '/' + node.routerLink.join('/');
    return this.currentUrl === routePath || this.currentUrl.startsWith(routePath + '/');
  }

  hasChildren(node: INavListItem): boolean {
    return !!node.children && node.children.length > 0;
  }

  // Auto-expand parent menus when child is active
  private autoExpandActive(): void {
    this.navItems.forEach(item => {
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
