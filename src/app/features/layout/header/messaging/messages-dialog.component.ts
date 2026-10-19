import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, timer } from 'rxjs';

import { ChatMessage, ConversationSummary } from '@features/interfaces/messaging.interface';
import { MessagingService } from '@features/services/messaging.service';
import { ToastService } from '@app/core/services/toast.service';
import { MessagingActions } from '@app/store';

/**
 * Mesajlar paneli: solda konuşmalar (Destek + şirketteki kişiler), sağda yazışma.
 * Açıkken konuşma listesi ve seçili yazışma düzenli aralıkla yenilenir.
 */
@Component({
  selector: 'app-messages-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, TranslateModule],
  template: `
    <div class="md">
      <aside class="md__list">
        <div class="md__list-head">
          <span class="md__title">{{ 'MESSAGING.MESSAGES' | translate }}</span>
          <button mat-icon-button class="md__close md__close--mobile" (click)="close()"><mat-icon>close</mat-icon></button>
        </div>
        <input class="md__search" type="text" [ngModel]="search()" (ngModelChange)="search.set($event)"
          [placeholder]="'MESSAGING.SEARCH_PEOPLE' | translate" />
        <div class="md__items">
          @for (c of filtered(); track c.peer) {
          <button type="button" class="md__item" [class.md__item--active]="selected()?.peer === c.peer"
            (click)="select(c)">
            <span class="md__avatar" [class.md__avatar--support]="c.type === 'support'">
              @if (c.type === 'support') { <mat-icon>support_agent</mat-icon> }
              @else if (c.user?.photo) { <img [src]="c.user!.photo!" alt="" /> }
              @else { {{ initials(c) }} }
            </span>
            <span class="md__item-text">
              <span class="md__item-name">{{ nameOf(c) }}</span>
              <span class="md__item-last">{{ c.last_message || (c.type === 'support' ? ('MESSAGING.SUPPORT_HINT' | translate) : '') }}</span>
            </span>
            @if (c.unread > 0) { <span class="md__badge">{{ c.unread }}</span> }
          </button>
          } @empty {
          <p class="md__empty">{{ 'MESSAGING.NO_PEOPLE' | translate }}</p>
          }
        </div>
      </aside>

      <section class="md__chat">
        <div class="md__chat-head">
          <span class="md__title">{{ selected() ? nameOf(selected()!) : ('MESSAGING.MESSAGES' | translate) }}</span>
          <button mat-icon-button class="md__close" (click)="close()"><mat-icon>close</mat-icon></button>
        </div>

        @if (!selected()) {
        <div class="md__placeholder">
          <mat-icon>forum</mat-icon>
          <p>{{ 'MESSAGING.SELECT_CONVERSATION' | translate }}</p>
        </div>
        } @else {
        <div class="md__messages" #scroller>
          @for (m of messages(); track m.id) {
          <div class="md__msg" [class.md__msg--mine]="m.mine">
            @if (!m.mine && selected()!.type === 'support' && m.feedback_id) {
            <span class="md__tag">{{ 'MESSAGING.FEEDBACK_REPLY' | translate }}</span>
            }
            <div class="md__bubble">
              @if (m.image_url) {
              <a [href]="m.image_url" target="_blank" rel="noopener">
                <img class="md__img" [src]="m.image_url" alt="" loading="lazy" />
              </a>
              }
              @if (m.body) { <span>{{ m.body }}</span> }
            </div>
            <span class="md__time">{{ m.created_at | date: 'dd.MM HH:mm' }}</span>
          </div>
          } @empty {
          <p class="md__empty">{{ 'MESSAGING.NO_MESSAGES' | translate }}</p>
          }
        </div>

        @if (previewUrl()) {
        <div class="md__preview">
          <img [src]="previewUrl()!" alt="" />
          <button type="button" mat-icon-button (click)="clearImage()"><mat-icon>close</mat-icon></button>
        </div>
        }
        <form class="md__composer" (submit)="$event.preventDefault(); send()">
          <input #fileInput type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden
            (change)="onFileChosen($event)" />
          <button type="button" mat-icon-button (click)="fileInput.click()" [disabled]="sending()">
            <mat-icon>attach_file</mat-icon>
          </button>
          <textarea rows="2" maxlength="2000" [(ngModel)]="draft" name="draft"
            [placeholder]="'MESSAGING.TYPE_MESSAGE' | translate" (keydown.enter)="onEnter($event)"
            (paste)="onPaste($event)"></textarea>
          <button mat-flat-button color="primary" type="submit" [disabled]="sending() || (!draft.trim() && !image())">
            <mat-icon>send</mat-icon>
            {{ 'MESSAGING.SEND' | translate }}
          </button>
        </form>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .md { display: flex; height: 100%; min-height: 0; background: #fff; }
    .md__list { width: 260px; flex-shrink: 0; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; min-height: 0; }
    .md__list-head, .md__chat-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; min-height: 52px; }
    .md__title { font-weight: 600; }
    .md__search { margin: 8px 12px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; }
    .md__items { flex: 1; overflow-y: auto; }
    .md__item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 0; background: transparent; cursor: pointer; text-align: left; font: inherit; }
    .md__item:hover { background: #f3f4f6; }
    .md__item--active { background: #e8f1fd; }
    .md__avatar { width: 36px; height: 36px; border-radius: 50%; background: #cbd5e1; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; overflow: hidden; flex-shrink: 0; }
    .md__avatar img { width: 100%; height: 100%; object-fit: cover; }
    .md__avatar--support { background: #2563eb; }
    .md__avatar mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .md__item-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .md__item-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .md__item-last { font-size: 12px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .md__badge { background: #dc2626; color: #fff; border-radius: 10px; min-width: 20px; padding: 0 6px; font-size: 11px; line-height: 20px; text-align: center; }
    .md__chat { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .md__placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af; }
    .md__placeholder mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .md__messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; background: #f9fafb; }
    .md__msg { display: flex; flex-direction: column; align-items: flex-start; max-width: 80%; }
    .md__msg--mine { align-self: flex-end; align-items: flex-end; }
    .md__bubble { background: #fff; border: 1px solid #e5e7eb; padding: 8px 12px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; }
    .md__msg--mine .md__bubble { background: #2563eb; border-color: #2563eb; color: #fff; }
    .md__time { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .md__tag { font-size: 11px; color: #2563eb; margin-bottom: 2px; }
    .md__composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #e5e7eb; align-items: flex-end; }
    .md__composer textarea { flex: 1; resize: none; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font: inherit; }
    .md__img { display: block; max-width: 100%; max-height: 240px; border-radius: 8px; margin-bottom: 4px; }
    .md__preview { display: flex; align-items: center; gap: 8px; padding: 6px 12px 0; }
    .md__preview img { max-height: 64px; border-radius: 6px; border: 1px solid #e5e7eb; }
    .md__empty { color: #9ca3af; text-align: center; padding: 16px; font-size: 13px; }
    .md__close--mobile { display: none; }
    @media (max-width: 640px) {
      .md__list { width: 120px; }
      .md__item-text, .md__item-last { display: none; }
      .md__close--mobile { display: none; }
    }
  `],
})
export class MessagesDialogComponent implements OnInit, OnDestroy {
  private readonly svc = inject(MessagingService);
  private readonly store = inject(Store);
  private readonly dialogRef = inject(MatDialogRef<MessagesDialogComponent>);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  readonly conversations = signal<ConversationSummary[]>([]);
  readonly selected = signal<ConversationSummary | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly search = signal('');
  readonly sending = signal(false);
  draft = '';

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.conversations();
    if (!q) return list;
    return list.filter(c => this.nameOf(c).toLowerCase().includes(q));
  });

  private poll?: Subscription;

  ngOnInit(): void {
    this.loadConversations();
    this.poll = timer(8000, 8000).subscribe(() => {
      this.loadConversations();
      if (this.selected()) this.loadMessages();
    });
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
    this.clearImage();
  }

  nameOf(c: ConversationSummary): string {
    return c.type === 'support' ? this.translate.instant('MESSAGING.SUPPORT') : (c.user?.name ?? '');
  }

  initials(c: ConversationSummary): string {
    const parts = (c.user?.name ?? '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  }

  close(): void {
    this.dialogRef.close();
  }

  private loadConversations(): void {
    this.svc.getConversations().subscribe({
      next: (list) => {
        this.conversations.set(list);
        // Seçili konuşmanın rozetini yeniden hesaplanan listeyle eşitle
        const cur = this.selected();
        if (cur) {
          const fresh = list.find(c => c.peer === cur.peer);
          if (fresh) this.selected.set({ ...fresh, unread: 0 });
        }
      },
      error: () => { /* arka plan yenilemesi: sessiz */ },
    });
  }

  select(c: ConversationSummary): void {
    this.selected.set(c);
    this.messages.set([]);
    this.clearImage();
    this.loadMessages(true);
  }

  private loadMessages(forceScroll = false): void {
    const cur = this.selected();
    if (!cur) return;
    this.svc.getMessages(cur.peer).subscribe({
      next: (msgs) => {
        // Yanıt geldiğinde başka konuşmaya geçilmişse sonucu yok say
        if (this.selected()?.peer !== cur.peer) return;
        const prev = this.messages();
        const changed = msgs.length !== prev.length || msgs[msgs.length - 1]?.id !== prev[prev.length - 1]?.id;
        this.messages.set(msgs);
        if (changed || forceScroll) this.scrollToBottom();
        if (msgs.some(m => !m.mine && !m.is_read)) this.markRead(cur.peer);
      },
      error: () => { /* sessiz */ },
    });
  }

  private markRead(peer: string): void {
    this.svc.markConversationRead(peer).subscribe({
      next: () => {
        this.conversations.update(list => list.map(c => (c.peer === peer ? { ...c, unread: 0 } : c)));
        this.store.dispatch(MessagingActions.loadSummary());
      },
      error: () => { /* sessiz */ },
    });
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return; // Shift+Enter: yeni satır
    e.preventDefault();
    this.send();
  }

  readonly image = signal<File | null>(null);
  readonly previewUrl = signal<string | null>(null);
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static readonly IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.setImage(file);
  }

  onPaste(event: ClipboardEvent): void {
    const file = Array.from(event.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      this.setImage(file);
    }
  }

  private setImage(file: File): void {
    if (!MessagesDialogComponent.IMAGE_TYPES.includes(file.type) || file.size > MessagesDialogComponent.MAX_IMAGE_BYTES) {
      this.toast.error(this.translate.instant('MESSAGING.IMAGE_INVALID'));
      return;
    }
    this.clearImage();
    this.image.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  clearImage(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.image.set(null);
    this.previewUrl.set(null);
  }

  send(): void {
    const cur = this.selected();
    const body = this.draft.trim();
    const image = this.image();
    if (!cur || (!body && !image) || this.sending()) return;

    this.sending.set(true);
    this.svc.sendMessage(cur.peer, body, image).subscribe({
      next: (m) => {
        this.messages.update(list => [...list, m]);
        this.draft = '';
        this.clearImage();
        this.sending.set(false);
        this.scrollToBottom();
        this.loadConversations();
      },
      error: () => {
        this.sending.set(false);
        this.toast.error(this.translate.instant('MESSAGING.SEND_ERROR'));
      },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scroller?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
