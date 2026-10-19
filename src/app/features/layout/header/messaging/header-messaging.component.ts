import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';

import {
  AppState,
  MessagingActions,
  selectNotifications,
  selectUnreadMessages,
  selectUnreadNotifications,
} from '@app/store';
import { AppNotification } from '@features/interfaces/messaging.interface';
import { MessagesDialogComponent } from './messages-dialog.component';

/** Header'da profil fotoğrafının yanındaki bildirim (zil) ve mesaj ikonları. */
@Component({
  selector: 'app-header-messaging',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatMenuModule, MatIconModule, MatButtonModule, MatBadgeModule, TranslateModule],
  template: `
    <button mat-icon-button class="hm__btn" [matMenuTriggerFor]="notifMenu" (menuOpened)="onMenuOpened()"
      [attr.aria-label]="'MESSAGING.NOTIFICATIONS' | translate"
      [matBadge]="notifBadge()" matBadgeColor="warn" matBadgeSize="small"
      [matBadgeHidden]="!unreadNotifications()">
      <mat-icon>notifications</mat-icon>
    </button>

    <button mat-icon-button class="hm__btn" (click)="openMessages()"
      [attr.aria-label]="'MESSAGING.MESSAGES' | translate"
      [matBadge]="messageBadge()" matBadgeColor="warn" matBadgeSize="small"
      [matBadgeHidden]="!unreadMessages()">
      <mat-icon>chat</mat-icon>
    </button>

    <mat-menu #notifMenu="matMenu" class="hm-menu" xPosition="before">
      <div class="hm__head" (click)="$event.stopPropagation()">
        <span class="hm__head-title">{{ 'MESSAGING.NOTIFICATIONS' | translate }}</span>
        @if (unreadNotifications()) {
        <button type="button" class="hm__link" (click)="markAll()">{{ 'MESSAGING.MARK_ALL_READ' | translate }}</button>
        }
      </div>
      <div class="hm__list">
        @for (n of notifications(); track n.id) {
        <div class="hm__item" role="menuitem" tabindex="0" [class.hm__item--unread]="!n.is_read"
          (click)="open(n)" (keydown.enter)="open(n)">
          <span class="hm__item-title">{{ n.title }}</span>
          @if (n.body) { <span class="hm__item-body">{{ n.body }}</span> }
          <span class="hm__item-time">{{ n.created_at | date: 'dd.MM HH:mm' }}</span>
        </div>
        } @empty {
        <p class="hm__empty" (click)="$event.stopPropagation()">{{ 'MESSAGING.NO_NOTIFICATIONS' | translate }}</p>
        }
      </div>
    </mat-menu>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; margin-right: 4px; }
    .hm__btn { color: inherit; }
    .hm__head { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid #e5e7eb; }
    .hm__head-title { font-weight: 600; }
    .hm__link { background: none; border: 0; color: #2563eb; cursor: pointer; font-size: 12px; }
    .hm__head, .hm__list { box-sizing: border-box; width: 280px; max-width: 100%; }
    .hm__list { overflow-x: hidden; }
    .hm__item { display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; cursor: pointer; white-space: normal; word-break: break-word; line-height: 1.35; border-bottom: 1px solid #f1f5f9; }
    .hm__item:hover { background: #f3f4f6; }
    .hm__item--unread { background: #eff6ff; }
    .hm__item-title { font-weight: 500; }
    .hm__item-body { font-size: 12px; color: #4b5563; }
    .hm__item-time { font-size: 11px; color: #9ca3af; }
    .hm__empty { text-align: center; color: #9ca3af; padding: 16px; font-size: 13px; }
  `],
})
export class HeaderMessagingComponent {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly unreadNotifications: Signal<number> = this.store.selectSignal(selectUnreadNotifications);
  readonly unreadMessages: Signal<number> = this.store.selectSignal(selectUnreadMessages);
  readonly notifications: Signal<AppNotification[]> = this.store.selectSignal(selectNotifications);

  // matBadge string | number | null bekler; store sinyalleri geniş tipli döndüğü için sayıya çevir.
  readonly notifBadge = computed<number | null>(() => Number(this.unreadNotifications()) || null);
  readonly messageBadge = computed<number | null>(() => Number(this.unreadMessages()) || null);

  onMenuOpened(): void {
    this.store.dispatch(MessagingActions.loadNotifications());
  }

  markAll(): void {
    this.store.dispatch(MessagingActions.markAllNotificationsRead());
  }

  open(n: AppNotification): void {
    if (!n.is_read) this.store.dispatch(MessagingActions.markNotificationRead({ id: n.id }));
    if (n.link) {
      if (/^https?:\/\//i.test(n.link)) window.open(n.link, '_blank', 'noopener');
      else this.router.navigateByUrl(n.link);
    }
  }

  openMessages(): void {
    const ref = this.dialog.open(MessagesDialogComponent, {
      width: '860px',
      maxWidth: '96vw',
      height: '600px',
      maxHeight: '90vh',
      panelClass: 'messages-dialog-panel',
    });
    ref.afterClosed().subscribe(() => this.store.dispatch(MessagingActions.loadSummary()));
  }
}
