// features/stepper/guards/feedback-exit.guard.ts
import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { selectOrderId, selectStep3IsDirty } from '@app/store';
import { OrderFeedbackService } from '@features/services/order-feedback.service';
import { FeedbackSectionKey } from '@features/interfaces/order-feedback.interface';
import {
  FeedbackDialogComponent,
  FeedbackDialogResult,
} from '../components/feedback-dialog/feedback-dialog.component';

/**
 * Stepper'dan çıkış: sonuç ekranında kaydedilmemiş değişiklik varsa geri
 * bildirim ZORUNLU (kullanıcı "sayfada kal" da diyebilir). Değişiklik
 * yoksa sessizce geçer.
 */
export const feedbackExitGuard: CanDeactivateFn<unknown> = async () => {
  const store = inject(Store);
  const dialog = inject(MatDialog);
  const feedbackService = inject(OrderFeedbackService);

  const dirty = await firstValueFrom(store.select(selectStep3IsDirty));
  const orderId = await firstValueFrom(store.select(selectOrderId));
  if (!dirty || !orderId) return true;

  const status = await firstValueFrom(
    feedbackService.getStatus(orderId).pipe(catchError(() => of(null)))
  );

  const sections: FeedbackSectionKey[] = ['placement'];
  if (status?.packages.changed) sections.unshift('packages');

  const result = await firstValueFrom(
    dialog.open<FeedbackDialogComponent, any, FeedbackDialogResult>(FeedbackDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data: { orderId, trigger: 'exit', required: true, initialSections: sections, allowStay: true },
    }).afterClosed()
  );

  return result === 'sent';
};
