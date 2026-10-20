import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, Signal, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
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
    <span class="hm__wrap" #notifWrap>
      <button mat-icon-button class="hm__btn" [class.hm__btn--alert]="!!unreadNotifications()"
        [matMenuTriggerFor]="notifMenu" (menuOpened)="onMenuOpened()"
        [attr.aria-label]="'MESSAGING.NOTIFICATIONS' | translate"
        [matBadge]="notifBadge()" matBadgeColor="warn" matBadgeSize="medium"
        [matBadgeHidden]="!unreadNotifications()">
        <mat-icon>notifications</mat-icon>
      </button>
    </span>

    <span class="hm__wrap" #msgWrap>
      <button mat-icon-button class="hm__btn" [class.hm__btn--alert]="!!unreadMessages()"
        (click)="openMessages()"
        [attr.aria-label]="'MESSAGING.MESSAGES' | translate"
        [matBadge]="messageBadge()" matBadgeColor="warn" matBadgeSize="medium"
        [matBadgeHidden]="!unreadMessages()">
        <mat-icon>chat</mat-icon>
      </button>
    </span>

    <!-- Yeni bildirim/mesaj geldiğinde ilgili ikonun hemen altında çıkan balon -->
    <div class="hm__toasts" [style.top.px]="stackPos().top" [style.right.px]="stackPos().right">
    @if (notifToast(); as t) {
    <div class="hm__toast" role="status" (click)="onNotifToastClick()">
      <span class="hm__toast-arrow" [style.right.px]="pos('notif').arrow"></span>
      <mat-icon class="hm__toast-icon">notifications_active</mat-icon>
      <div class="hm__toast-text">
        <strong>{{ 'MESSAGING.TOAST_NEW_NOTIFICATIONS' | translate:{count: t.count} }}</strong>
        @if (latestUnreadTitle()) { <span class="hm__toast-body">{{ latestUnreadTitle() }}</span> }
        <span class="hm__toast-hint">{{ 'MESSAGING.TOAST_CLICK' | translate }}</span>
      </div>
      <button type="button" class="hm__toast-close" (click)="dismissToast('notif'); $event.stopPropagation()"
        aria-label="close"><mat-icon>close</mat-icon></button>
    </div>
    }
    @if (msgToast(); as t) {
    <div class="hm__toast" role="status" (click)="onMsgToastClick()">
      <span class="hm__toast-arrow" [style.right.px]="pos('msg').arrow"></span>
      <mat-icon class="hm__toast-icon">mark_chat_unread</mat-icon>
      <div class="hm__toast-text">
        <strong>{{ 'MESSAGING.TOAST_NEW_MESSAGES' | translate:{count: t.count} }}</strong>
        <span class="hm__toast-hint">{{ 'MESSAGING.TOAST_CLICK' | translate }}</span>
      </div>
      <button type="button" class="hm__toast-close" (click)="dismissToast('msg'); $event.stopPropagation()"
        aria-label="close"><mat-icon>close</mat-icon></button>
    </div>
    }
    </div>

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
    .hm__wrap { display: inline-flex; }
    .hm__btn { color: inherit; }

    /* Okunmamış varken ikon dikkat çeker: zil sallanır, rozet nabız atar. */
    .hm__btn--alert mat-icon { transform-origin: 50% 8%; animation: hm-ring 3.5s ease-in-out infinite; }
    :host ::ng-deep .hm__btn--alert .mat-badge-content { animation: hm-pulse 1.6s ease-out infinite; font-weight: 700; }
    @keyframes hm-ring {
      0%, 55%, 100% { transform: rotate(0); }
      60% { transform: rotate(16deg); } 65% { transform: rotate(-14deg); }
      70% { transform: rotate(10deg); } 75% { transform: rotate(-8deg); } 80% { transform: rotate(4deg); } 85% { transform: rotate(0); }
    }
    @keyframes hm-pulse {
      0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.65); }
      70% { box-shadow: 0 0 0 9px rgba(244, 67, 54, 0); }
      100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
    }

    .hm__toasts { position: fixed; z-index: 2000; display: flex; flex-direction: column; align-items: flex-end; gap: 12px; pointer-events: none; }
    .hm__toast { position: relative; pointer-events: auto; display: flex; align-items: flex-start; gap: 10px; width: 300px; max-width: calc(100vw - 16px);
      padding: 12px 8px 12px 14px; background: #fff; color: #1f2937; border-radius: 10px; border-left: 4px solid #2563eb;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.28); cursor: pointer; animation: hm-toast-in .28s ease-out; }
    .hm__toast-arrow { position: absolute; top: -6px; width: 12px; height: 12px; background: #fff; transform: rotate(45deg); }
    .hm__toast-icon { color: #2563eb; flex-shrink: 0; }
    .hm__toast-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; font-size: 13px; line-height: 1.35; }
    .hm__toast-body { color: #4b5563; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hm__toast-hint { color: #2563eb; font-size: 11px; }
    .hm__toast-close { border: 0; background: none; cursor: pointer; color: #9ca3af; padding: 0; line-height: 0; }
    .hm__toast-close mat-icon { font-size: 18px; width: 18px; height: 18px; }
    @keyframes hm-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

    @media (prefers-reduced-motion: reduce) {
      .hm__btn--alert mat-icon, :host ::ng-deep .hm__btn--alert .mat-badge-content, .hm__toast { animation: none; }
    }
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
export class HeaderMessagingComponent implements OnDestroy {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly pageTitle = inject(Title);

  @ViewChild('notifWrap') notifWrap?: ElementRef<HTMLElement>;
  @ViewChild('msgWrap') msgWrap?: ElementRef<HTMLElement>;
  @ViewChild(MatMenuTrigger) notifTrigger?: MatMenuTrigger;

  readonly unreadNotifications: Signal<number> = this.store.selectSignal(selectUnreadNotifications);
  readonly unreadMessages: Signal<number> = this.store.selectSignal(selectUnreadMessages);
  readonly notifications: Signal<AppNotification[]> = this.store.selectSignal(selectNotifications);

  // matBadge string | number | null bekler; store sinyalleri geniş tipli döndüğü için sayıya çevir.
  readonly notifBadge = computed<number | null>(() => Number(this.unreadNotifications()) || null);
  readonly messageBadge = computed<number | null>(() => Number(this.unreadMessages()) || null);

  // ───── Dikkat çekme: ikon animasyonu (CSS) + ikonun altında balon + sekme başlığı ─────
  readonly notifToast = signal<{ count: number } | null>(null);
  readonly msgToast = signal<{ count: number } | null>(null);
  /** Balonda gösterilen: en yeni okunmamış bildirimin başlığı. */
  readonly latestUnreadTitle = computed(() => this.notifications().find(n => !n.is_read)?.title ?? '');

  private prevNotif = 0;
  private prevMsg = 0;
  private toastTimers: { notif?: any; msg?: any } = {};
  private readonly TOAST_MS = 15000;

  private readonly alertEffect = effect(() => {
    const notif = Number(this.unreadNotifications()) || 0;
    const msg = Number(this.unreadMessages()) || 0;
    untracked(() => {
      if (notif > this.prevNotif) this.showToast('notif', notif);
      else if (notif === 0) this.dismissToast('notif');
      if (msg > this.prevMsg) this.showToast('msg', msg);
      else if (msg === 0) this.dismissToast('msg');
      this.prevNotif = notif;
      this.prevMsg = msg;
      this.updateTabTitle(notif + msg);
    });
  });

  constructor() {
    // Rota değişince başlık yeniden yazılır; okunmamış sayısını tekrar öne ekle.
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      setTimeout(() => this.updateTabTitle(this.prevNotif + this.prevMsg));
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimers.notif);
    clearTimeout(this.toastTimers.msg);
    this.updateTabTitle(0);
  }

  private showToast(kind: 'notif' | 'msg', count: number): void {
    // Görünüm (ViewChild) hazır olsun diye bir sonraki turda göster.
    setTimeout(() => {
      if (kind === 'notif') {
        this.store.dispatch(MessagingActions.loadNotifications()); // balonda başlığı gösterebilmek için
        this.notifToast.set({ count });
      } else {
        this.msgToast.set({ count });
      }
      clearTimeout(this.toastTimers[kind]);
      this.toastTimers[kind] = setTimeout(() => this.dismissToast(kind), this.TOAST_MS);
    });
  }

  dismissToast(kind: 'notif' | 'msg'): void {
    clearTimeout(this.toastTimers[kind]);
    (kind === 'notif' ? this.notifToast : this.msgToast).set(null);
  }

  /** Balonun ekran konumu: ilgili ikonun hemen altı (fixed → header'ın taşma/kırpma ayarlarından etkilenmez). */
  /** Balonlar tek sütunda üst üste dizilir (binmez); sütun en sağdaki ikona hizalanır. */
  stackPos(): { top: number; right: number } {
    const a = this.notifWrap?.nativeElement.getBoundingClientRect();
    const b = this.msgWrap?.nativeElement.getBoundingClientRect();
    const rects = [a, b].filter((r): r is DOMRect => !!r);
    if (!rects.length) return { top: 64, right: 16 };
    const rightEdge = Math.max(...rects.map(r => r.right));
    return { top: Math.max(...rects.map(r => r.bottom)) + 10, right: Math.max(8, window.innerWidth - rightEdge - 12) };
  }

  pos(kind: 'notif' | 'msg'): { top: number; right: number; arrow: number } {
    const el = (kind === 'notif' ? this.notifWrap : this.msgWrap)?.nativeElement;
    const rect = el?.getBoundingClientRect();
    if (!rect) return { top: 64, right: 16, arrow: 20 };
    const arrow = Math.max(8, window.innerWidth - rect.right + rect.width / 2 - this.stackPos().right - 6);
    return { top: rect.bottom + 10, right: 0, arrow };
  }

  onNotifToastClick(): void {
    this.dismissToast('notif');
    this.notifTrigger?.openMenu();
  }

  onMsgToastClick(): void {
    this.dismissToast('msg');
    this.openMessages();
  }

  private updateTabTitle(total: number): void {
    const base = this.pageTitle.getTitle().replace(/^\(\d+\)\s*/, '');
    this.pageTitle.setTitle(total > 0 ? `(${total}) ${base}` : base);
  }

  onMenuOpened(): void {
    this.dismissToast('notif');
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
    this.dismissToast('msg');
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
