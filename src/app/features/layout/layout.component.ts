import { Component, OnDestroy, ViewChild } from '@angular/core';
import { takeUntil } from 'rxjs';
import { Subject } from 'rxjs';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { SidenavComponent } from './sidenav/sidenav.component';
import { HeaderComponent } from './header/header.component';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDividerModule } from '@angular/material/divider';
import { RouterOutlet } from '@angular/router';
import { ISidenavConfig } from './sidenav/isidenav-config';
// https://material.angular.io/cdk/layout/overview

export interface Tile {
  color: string;
  cols: number;
  rows: number;
  text: string;
}

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: true,
  imports: [SidenavComponent, MatDividerModule, HeaderComponent, RouterOutlet, MatGridListModule],

})
export class LayoutComponent implements OnDestroy {

  @ViewChild(SidenavComponent) sidenav!: SidenavComponent;

  destroyed = new Subject<any>();

  tiles: Tile[] = [
    { text: 'One', cols: 4, rows: 1, color: 'lightblue' },
    { text: 'Two', cols: 1, rows: 2, color: 'lightgreen' },
    { text: 'Three', cols: 1, rows: 1, color: 'lightpink' },
    { text: 'Four', cols: 2, rows: 1, color: '#DDBDF1' },
  ];

  sidenavConfig: ISidenavConfig = {
    mode: 'side',
    isSidenavOpen: true,
    isToggleButtonVisible: false
  }

  displayNameMap = new Map([
    [Breakpoints.XSmall, 'XSmall'],
    [Breakpoints.Small, 'Small'],
    [Breakpoints.Medium, 'Medium'],
    [Breakpoints.Large, 'Large'],
    [Breakpoints.XLarge, 'XLarge'],
  ])

  constructor(private breakpointObserver: BreakpointObserver) {
    this.checkBreakpoints();
  }

  sidenavOpen() {
    this.sidenav.open();
  }

  checkBreakpoints() {
    this.breakpointObserver
      .observe([
        // gozlemlemek istedigin breakpointleri buraya ekliyorsun
        Breakpoints.XSmall,
        Breakpoints.Small,
        Breakpoints.Medium,
        Breakpoints.Large,
        Breakpoints.XLarge
      ])
      .pipe(takeUntil(this.destroyed))
      .subscribe(result => {
        // gozlemledigin breakpointler  breakpoint: boolean formatinda liste halinde result icerisinde donuyor
        //
        for (const query of Object.keys(result.breakpoints)) { // listeyi donerek true olan kirilmayi buluyorsun
          if (result.breakpoints[Breakpoints.XSmall]) {
            this.sidenavConfig.isSidenavOpen = false;
            this.sidenavConfig.mode = 'over';
          } else if (result.breakpoints[Breakpoints.Small]) {
            this.sidenavConfig.isSidenavOpen = false;
            this.sidenavConfig.mode = 'over';
          } else {
            this.sidenavConfig.isSidenavOpen = false;
            this.sidenavConfig.mode = 'over';
          }
        }
        this.sidenavConfig.isToggleButtonVisible = !this.sidenavConfig.isSidenavOpen;
      });
  }

  ngOnDestroy(): void {
    this.destroyed.next(null);
    this.destroyed.complete();
  }
}
