// features/stepper/guards/feedback-exit.guard.ts
import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { selectDeletedPackages, selectOrderId, selectStep3IsDirty } from '@app/store';
import { OrderFeedbackService } from '@features/services/order-feedback.service';
import { LoadingService } from '@app/shared/loading/loading.service';
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
  const loadingService = inject(LoadingService);

  const dirty = await firstValueFrom(store.select(selectStep3IsDirty));
  const orderId = await firstValueFrom(store.select(selectOrderId));
  if (!dirty || !orderId) return true;

  // Yerleşmeyen (silinen) paket varsa sipariş henüz tamamlanmış sayılmaz;
  // kullanıcı bu siparişe geri dönecek. Bu durumda sayfa değiştirirken geri
  // bildirim İSTENMEZ — sadece "Bitir" (tamamla) akışında sorulur
  // (bkz. result-step: requestFeedbackThenComplete).
  const unplaced = await firstValueFrom(store.select(selectDeletedPackages));
  if (unplaced.length > 0) return true;

  // Sessiz sorgu: guard beklerken ayrıca spinner açılmasın.
  const status = await firstValueFrom(
    feedbackService.getStatus(orderId, true).pipe(catchError(() => of(null)))
  );

  const sections: FeedbackSectionKey[] = ['placement'];
  if (status?.packages.changed) sections.unshift('packages');

  // NavigationStart global spinner'ı açmıştı (app.component) ve navigasyon
  // guard bitene kadar sürdüğü için spinner dialog'un ÜSTÜNDE takılı kalıyor,
  // dialog'a tıklanamıyordu. Dialog'u açmadan önce kapat; navigasyon
  // bitince/iptal olunca (NavigationEnd/Cancel) zaten tekrar kapatılır.
  loadingService.forceOff();

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
