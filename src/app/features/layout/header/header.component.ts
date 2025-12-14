import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild, signal, computed } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core'; // ✅ Comment'i kaldır
import { AuthService } from '@app/core/auth/services/auth.service';
import { OrderService } from '@app/features/services/order.service';
import { CancelConfirmationDialogComponent } from '@app/shared/cancel-confirmation-dialog/cancel-confirmation-dialog.component';
import { AppState, selectOrderId, selectUser } from '@app/store';
import { LanguageService, Language } from '@app/core/services/language.service'; // ✅ Comment'i kaldır

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatToolbarModule,
    MatIconModule,
    CommonModule,
    RouterLink,
    MatDividerModule,
    TranslateModule
  ],
  standalone: true,
})
export class HeaderComponent implements OnInit {
  @ViewChild('themeMenu') themeMenu!: MatMenu;
  @Input() isToggleButton!: Boolean;
  @Output() sidenavOpen: EventEmitter<any> = new EventEmitter();

  profilePhoto = 'https://cdn-icons-png.flaticon.com/512/219/219986.png';
  companyLogo: string = 'assets/icons/bedisa.png';

  private readonly store = inject(Store<AppState>);
  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly languageService = inject(LanguageService);

  orderId = this.store.selectSignal(selectOrderId);
  user$ = this.store.select(selectUser);

  languages = this.languageService.LANGUAGES;
  currentLanguage$ = this.languageService.currentLanguage$;

  private currentUrl = signal(this.router.url);

  showCancelButton = computed(() => {
    const url = this.currentUrl();
    const cleanUrl = url.split('?')[0];
    return (cleanUrl === '/' || cleanUrl === '' || cleanUrl.length === 0) && this.orderId();
  });

  ngOnInit(): void {
    this.getProfilePhoto();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl.set(event.url);
    });
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
    this.authService.doLogout();
  }

  onLanguageChange(langCode: string): void {
    this.languageService.setLanguage(langCode); // ✅ Implement et
  }

  getCurrentLanguage(): Language {
    const currentLang = this.languageService.getCurrentLanguage();
    return this.languageService.getLanguageByCode(currentLang) || this.languages[0];
  }

  onCancelClick(): void {
    const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      disableClose: true,
      panelClass: 'cancel-confirmation-dialog',
      data: {
        header: 'DIALOG.CANCEL_OPERATION',
        title: 'DIALOG.CANCEL_CONFIRMATION_TITLE',
        info: 'DIALOG.CANCEL_CONFIRMATION_INFO',
        confirmButtonText: 'DIALOG.YES_CANCEL',
        showYesButton: true,
        rejectButtonText: 'DIALOG.NO'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.handleCancellation();
      }
    });
  }

  private handleCancellation(): void {
    this.orderService.delete(this.orderId()).subscribe({
      next: () => {
        this.authService.clearLocalAndStore();
      },
      error: (error) => {
        this.authService.clearLocalAndStore();
      }
    });
  }
}
