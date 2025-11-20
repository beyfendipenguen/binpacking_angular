import { NestedTreeControl } from '@angular/cdk/tree';
import { Component, ViewChild, Input } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { MatSidenav, MatSidenavContent, MatSidenavModule } from '@angular/material/sidenav';
import { MatDrawerMode } from '@angular/material/sidenav';
import { MatNestedTreeNode, MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatListModule, MatNavList } from "@angular/material/list";
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { INavListItem } from './inav-list-item';

const NAV_LIST_ITEM: INavListItem[] = [
  {
    routerLink: [''],
    title: 'Yerlestirme Hesaplama',
    icon: 'home'
  },
  {
    title: 'İşlemler',
    icon: 'home',
    children: [
      {
        routerLink: ['/orders'],
        title: 'Sipariş Yönetimi',
        icon: 'assignment'
      },
      {
        routerLink: ['/products'],
        title: 'Ürün Yönetimi',
        icon: 'inventory'
      }
    ]
  },
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
    MatNestedTreeNode,
    CommonModule,
    MatTreeModule,
    MatNavList
  ]
})
export class SidenavComponent {
  @Input('mode') sidenavMode!: MatDrawerMode;
  @Input() isOpen!: boolean;
  @ViewChild('sidenav', { static: true, read: MatSidenav }) sidenav!: MatSidenav;

  treeControl = new NestedTreeControl<INavListItem>(node => node.children);
  dataSource = new MatTreeNestedDataSource<INavListItem>();

  constructor(private matIconRegistry: MatIconRegistry, private domSanitizer: DomSanitizer) {
    // this.matIconRegistry.addSvgIcon(
    //   'productIcon',
    //   this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/product.svg'))
    //   .addSvgIcon(
    //     'shelfIcon',
    //     this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/shelf.svg')
    //   ).addSvgIcon(
    //     'shelf2Icon',
    //     this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/shelf2.svg')
    //   ).addSvgIcon(
    //     'shelf3Icon',
    //     this.domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/shelf3.svg')
    //   );
    this.dataSource.data = NAV_LIST_ITEM;
  }

  hasChild = (_: number, node: INavListItem) => !!node.children && node.children.length > 0;

  open() {
    this.sidenav.open();
  }

  listItemClasses(title: string) {
    return { 'slide-text': title.length > 12 };
  }

}
