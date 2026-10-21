// features/stepper/components/feedback-reaction/feedback-reaction.component.ts
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FeedbackSection, FeedbackSectionKey } from '@features/interfaces/order-feedback.interface';
import { OrderFeedbackService } from '@features/services/order-feedback.service';
import { ToastService } from '@core/services/toast.service';
import { FeedbackDialogComponent } from '../feedback-dialog/feedback-dialog.component';

/**
 * Beğen / beğenme butonları. Hesapla (paketleme) ve Optimizasyonu çalıştır
 * (tır yerleşimi) butonlarının yanında durur. Beğenme → neden sormak için
 * (opsiyonel) geri bildirim dialogunu açar.
 */
@Component({
  selector: 'app-feedback-reaction',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, TranslateModule],
  template: `
    <span class="fb-reaction">
      <button type="button" class="fb-reaction__btn" [class.liked]="liked() === true"
        [matTooltip]="'FEEDBACK.LIKE_TIP' | translate" (click)="react(true)">
        <mat-icon>thumb_up</mat-icon>
      </button>
      <button type="button" class="fb-reaction__btn" [class.disliked]="liked() === false"
        [matTooltip]="'FEEDBACK.DISLIKE_TIP' | translate" (click)="react(false)">
        <mat-icon>thumb_down</mat-icon>
      </button>
    </span>
  `,
  styles: [`
    .fb-reaction { display: inline-flex; gap: 0.25rem; margin-left: 0.5rem; vertical-align: middle; }
    .fb-reaction__btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      border: 1px solid rgba(0,0,0,0.2); background: #fff; color: #555; cursor: pointer;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: #f1f1f1; }
      &.liked { background: #2e7d32; border-color: #2e7d32; color: #fff; }
      &.disliked { background: #c62828; border-color: #c62828; color: #fff; }
    }
  `],
})
export class FeedbackReactionComponent implements OnChanges {
  @Input({ required: true }) section!: FeedbackSectionKey;
  @Input({ required: true }) orderId!: string;
  /** Değiştiğinde (örn. yeni hesaplama) önceki tepki sıfırlanır. */
  @Input() resetKey: unknown;
  /** true olduğunda (ekrandaki içerik kaydedilmemiş şekilde değişti) geri bildirim UI'da sıfırlanır. */
  @Input() dirty = false;

  private feedbackService = inject(OrderFeedbackService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  liked = signal<boolean | null>(null);

  /** Sunucuda kayıtlı önceki geri bildirim (neden/yorum dahil). */
  private saved: FeedbackSection | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.orderId) {
      this.liked.set(null);
      this.saved = null;
      return;
    }
    // İçerik değişti (isDirty): önceki geri bildirim eskidi → UI sıfırlanır,
    // kullanıcı yeni durum için tekrar geri bildirim verebilir. Sunucudaki
    // eski kayıt silinmez (yeni gönderimde ayrı kayıt açılır).
    if (changes['dirty'] && this.dirty) {
      this.liked.set(null);
      this.saved = null;
      return;
    }
    if (this.dirty && !changes['orderId'] && !changes['resetKey']) {
      return;
    }
    // Arka plan sorgusu: global yükleme göstergesi açılmasın (silent).
    this.feedbackService.getStatus(this.orderId, true).subscribe({
      next: (st) => {
        this.saved = st.feedback?.[this.section] ?? null;
        this.liked.set(this.saved?.liked ?? null);
      },
      error: () => { /* durum alınamazsa boş başla */ },
    });
  }

  private openDialog(): void {
    this.dialog.open(FeedbackDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        orderId: this.orderId,
        trigger: 'like',
        required: false,
        initialSections: [this.section],
        initialLiked: { [this.section]: false },
        initialValues: this.saved ? { [this.section]: this.saved } : undefined,
      },
    }).afterClosed().subscribe(() => {
      // Kaydedilmemiş değişiklik varken sunucu durumu ekrandakinden farklı olabilir;
      // yerel durum korunur (yeniden sorgulanırsa yeni verilen geri bildirim kaybolur).
      if (this.dirty) return;
      this.feedbackService.getStatus(this.orderId, true).subscribe(st => {
        this.saved = st.feedback?.[this.section] ?? null;
        this.liked.set(this.saved?.liked ?? null);
      });
    });
  }

  react(liked: boolean): void {
    if (!this.orderId) return;
    // Zaten "beğenmedim" iken tekrar basılırsa: eski verilerle dialog açılır.
    if (liked === false && this.liked() === false) {
      this.openDialog();
      return;
    }
    const next = this.liked() === liked ? null : liked;
    this.liked.set(next);
    if (next === null) return;

    this.feedbackService.submit(this.orderId, {
      [this.section]: { liked: next, reasons: [], comment: '' },
      trigger: 'like',
    }).subscribe({
      next: () => {
        if (next === false) {
          // Neden opsiyonel: dialog açılır, kullanıcı atlayabilir.
          this.saved = { liked: false, reasons: this.saved?.reasons ?? [], comment: this.saved?.comment ?? '' };
          this.openDialog();
        } else {
          if (this.saved) this.saved = { ...this.saved, liked: true };
          this.toast.success(this.translate.instant('FEEDBACK.THANKS'));
        }
      },
      error: () => this.toast.error(this.translate.instant('FEEDBACK.SEND_ERROR')),
    });
  }
}
