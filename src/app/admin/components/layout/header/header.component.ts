import { Component, EventEmitter, inject, Input, OnInit, Output, ViewChild, signal, computed, effect } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { AppState, resetStepper, selectOrderId, selectUser } from '../../../../store';
import { AuthService } from '../../../../auth/services/auth.service';
import { CancelConfirmationDialogComponent } from '../../../../components/cancel-confirmation-dialog/cancel-confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { OrderService } from '../../services/order.service';

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
  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  orderId = this.store.selectSignal(selectOrderId)
  user$ = this.store.select(selectUser);


  // Current URL'i signal olarak tut
  private currentUrl = signal(this.router.url);

  // Computed signal ile otomatik hesaplama
  showCancelButton = computed(() => {
    const url = this.currentUrl();
    const cleanUrl = url.split('?')[0];
    return (cleanUrl === '/' || cleanUrl === '' || cleanUrl.length === 0) && this.orderId();
  });

  ngOnInit(): void {
    this.getProfilePhoto();

    // Router değişikliklerini dinle ve signal'i güncelle
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

  onCancelClick(): void {
    const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      disableClose: true,
      panelClass: 'cancel-confirmation-dialog',
      data: {
        header: "İşlemi İptal Et",
        title: "İşlemi iptal etmek istediğinizden emin misiniz?",
        info: "Girdiğiniz tüm bilgiler kaybolacaktır.",
        confirmButtonText: "Evet, İptal Et"
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.handleCancellation();
      }
    });
  }

  private handleCancellation(): void {
    console.log('İşlem iptal edildi');
    this.orderService.delete(this.orderId()).subscribe({
      next: () => {
        this.authService.clearLocalAndStore()
      },
      error: (error) => {
        this.authService.clearLocalAndStore()
      }
    });
  }
}
