import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { AppState, selectOrder, selectOrderId, selectUser } from '../../../../store';
import { AuthService } from '../../../../auth/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [MatButtonModule, MatMenuModule, MatToolbarModule, MatIconModule, CommonModule, RouterLink, MatDividerModule],
  standalone: true,
})
export class HeaderComponent implements OnInit {
  @ViewChild('themeMenu') themeMenu!: MatMenu;
  @Input() isToggleButton!: Boolean;
  @Output() sidenavOpen: EventEmitter<any> = new EventEmitter();

  profilePhoto = 'https://cdn-icons-png.flaticon.com/512/219/219986.png';
  companyLogo: string = 'assets/icons/bedisa.png';

  private readonly store = inject(Store<AppState>);
  private readonly authService = inject(AuthService)
  user$ = this.store.select(selectUser);
  order = this.store.selectSignal(selectOrderId);

  constructor(private router: Router) {
  }

  ngOnInit(): void {
    this.getProfilePhoto()
  }

  getProfilePhoto() {
    this.user$.subscribe({
      next: (user) => {
        if (user) {
          this.profilePhoto = user.profile_picture || this.profilePhoto;
          this.companyLogo = user.company?.logo || this.companyLogo;
        }
      }
    });
  }

  logout() {
    this.authService.doLogout()
  }

}
