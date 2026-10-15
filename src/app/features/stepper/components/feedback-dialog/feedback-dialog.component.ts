// features/stepper/components/feedback-dialog/feedback-dialog.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  FeedbackSection,
  FeedbackSectionKey,
  FeedbackTrigger,
  OrderFeedback,
} from '@features/interfaces/order-feedback.interface';
import { OrderFeedbackService } from '@features/services/order-feedback.service';
import { ToastService } from '@core/services/toast.service';

export interface FeedbackDialogData {
  orderId: string;
  trigger: FeedbackTrigger;
  /** true ise en az bir bölüm doldurulmadan gönderilemez ve "Vazgeç" yoktur. */
  required: boolean;
  /** Başlangıçta işaretli bölümler. */
  initialSections?: FeedbackSectionKey[];
  /** Beğen/beğenme butonundan gelen ön değer. */
  initialLiked?: Partial<Record<FeedbackSectionKey, boolean | null>>;
  /** Önceden kaydedilmiş değerler (neden/yorum) — form bunlarla dolar. */
  initialValues?: Partial<Record<FeedbackSectionKey, FeedbackSection>>;
  /** Tır yerleşimi sonucu yoksa o bölüm devre dışı olur. */
  placementAvailable?: boolean;
  /** Çıkış akışında "sayfada kal" butonu gösterilir. */
  allowStay?: boolean;
}

export type FeedbackDialogResult = 'sent' | 'skipped' | 'stay';

interface SectionState {
  key: FeedbackSectionKey;
  enabled: boolean;
  liked: boolean | null;
  reasons: Set<string>;
  comment: string;
}

const REASONS: Record<FeedbackSectionKey, string[]> = {
  packages: ['SMALL_PALLETS', 'MIXED_PALLETS', 'WRONG_PALLET_TYPE', 'TOO_MANY_PALLETS', 'OTHER'],
  placement: ['EMPTY_SPACE', 'ROTATION_TOO_STRICT', 'WEIGHT_LIMIT', 'UNPLACED', 'WRONG_ORDER', 'OTHER'],
};

@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatTooltipModule, TranslateModule],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.scss',
})
export class FeedbackDialogComponent {
  readonly data: FeedbackDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<FeedbackDialogComponent, FeedbackDialogResult>);
  private feedbackService = inject(OrderFeedbackService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  isSending = false;

  /** Tır yerleşimi sonucu var mı (yoksa o bölüm devre dışı). */
  placementReady = this.data.placementAvailable !== false;

  readonly sections: SectionState[] = (['packages', 'placement'] as FeedbackSectionKey[]).map(key => ({
    key,
    enabled: (this.data.initialSections ?? []).includes(key) && !(key === 'placement' && !this.placementReady),
    liked: this.data.initialLiked?.[key] ?? this.data.initialValues?.[key]?.liked ?? null,
    reasons: new Set<string>(this.data.initialValues?.[key]?.reasons ?? []),
    comment: this.data.initialValues?.[key]?.comment ?? '',
  }));

  constructor() {
    if (this.data.placementAvailable !== undefined) {
      this.applyPlacementAvailability(this.data.placementAvailable);
    }
    this.feedbackService.getStatus(this.data.orderId).subscribe({
      next: (st) => {
        if (this.data.placementAvailable === undefined) {
          this.applyPlacementAvailability(st.has_result);
        }
        this.prefillFromSaved(st.feedback);
      },
      error: () => { /* durum alınamazsa boş başla */ },
    });
  }

  /** Daha önce kaydedilmiş geri bildirimi (iki bölüm için de) forma doldurur. */
  private prefillFromSaved(saved: OrderFeedback | undefined): void {
    if (!saved) return;
    for (const s of this.sections) {
      const prev = saved[s.key];
      const touched = s.reasons.size > 0 || s.comment.trim().length > 0;
      if (!prev || touched) continue;
      s.reasons = new Set(prev.reasons ?? []);
      s.comment = prev.comment ?? '';
      if (s.liked === null) s.liked = prev.liked ?? null;
      const hasContent = prev.liked !== null || s.reasons.size > 0 || s.comment.length > 0;
      if (hasContent && !this.isDisabled(s.key)) s.enabled = true;
    }
  }

  private applyPlacementAvailability(available: boolean): void {
    this.placementReady = available;
    if (!available) {
      const s = this.sections.find(x => x.key === 'placement');
      if (s) s.enabled = false;
    }
  }

  isDisabled(key: FeedbackSectionKey): boolean {
    return key === 'placement' && !this.placementReady;
  }

  reasonsFor(key: FeedbackSectionKey): string[] {
    return REASONS[key];
  }

  setLiked(s: SectionState, liked: boolean): void {
    s.liked = s.liked === liked ? null : liked;
  }

  toggleReason(s: SectionState, reason: string): void {
    s.reasons.has(reason) ? s.reasons.delete(reason) : s.reasons.add(reason);
  }

  private isFilled(s: SectionState): boolean {
    return s.enabled && (s.liked !== null || s.reasons.size > 0 || s.comment.trim().length > 0);
  }

  get canSubmit(): boolean {
    if (this.isSending) return false;
    return this.sections.some(s => this.isFilled(s));
  }

  async send(): Promise<void> {
    if (!this.canSubmit) return;
    this.isSending = true;

    const toSection = (s: SectionState): FeedbackSection | null =>
      this.isFilled(s)
        ? { liked: s.liked, reasons: [...s.reasons], comment: s.comment.trim() }
        : null;

    const payload: any = {
      packages: toSection(this.sections[0]),
      placement: toSection(this.sections[1]),
      trigger: this.data.trigger,
    };

    // Ekran görüntüsü + ekrandaki son yerleşim (beğen/beğenme anında gerekmez).
    if (this.data.trigger !== 'like') {
      try {
        // Ekran görüntüsü sadece "beğenmedim" için alınır.
        const disliked = payload.packages?.liked === false || payload.placement?.liked === false;
        payload.screenshot = disliked ? (this.feedbackService.screenshotProvider?.() ?? null) : null;
        payload.result = (await this.feedbackService.resultProvider?.()) ?? null;
      } catch {
        /* ekran görüntüsü/sonuç alınamasa da geri bildirim gönderilir */
      }
    }

    this.feedbackService.submit(this.data.orderId, payload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('FEEDBACK.THANKS'));
        this.dialogRef.close('sent');
      },
      error: () => {
        this.isSending = false;
        this.toast.error(this.translate.instant('FEEDBACK.SEND_ERROR'));
      },
    });
  }

  skip(): void {
    this.dialogRef.close('skipped');
  }

  stay(): void {
    this.dialogRef.close('stay');
  }
}
