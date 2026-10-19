import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { EMPTY, of, timer } from 'rxjs';
import { catchError, map, mergeMap, switchMap, takeUntil } from 'rxjs/operators';
import { MessagingService } from '@features/services/messaging.service';
import { MessagingActions } from './messaging.actions';

/** Okunmamış bildirim/mesaj sayacının yoklama aralığı. */
const POLL_INTERVAL_MS = 30_000;

@Injectable()
export class MessagingEffects {
  private actions$ = inject(Actions);
  private messagingService = inject(MessagingService);

  // Header açıkken düzenli olarak sayaçları yeniler (anında push yok, yoklama).
  poll$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MessagingActions.startPolling),
      switchMap(() =>
        timer(0, POLL_INTERVAL_MS).pipe(
          takeUntil(this.actions$.pipe(ofType(MessagingActions.stopPolling))),
          map(() => MessagingActions.loadSummary())
        )
      )
    )
  );

  loadSummary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MessagingActions.loadSummary),
      switchMap(() =>
        this.messagingService.getSummary().pipe(
          map((summary) => MessagingActions.loadSummarySuccess({ summary })),
          catchError(() => of(MessagingActions.loadSummaryFailure()))
        )
      )
    )
  );

  loadNotifications$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MessagingActions.loadNotifications),
      switchMap(() =>
        this.messagingService.getNotifications().pipe(
          map((page) => MessagingActions.loadNotificationsSuccess({ notifications: page.results })),
          catchError(() => of(MessagingActions.loadNotificationsFailure()))
        )
      )
    )
  );

  markRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MessagingActions.markNotificationRead),
      mergeMap(({ id }) =>
        this.messagingService.markNotificationRead(id).pipe(
          map(() => MessagingActions.markNotificationReadSuccess({ id })),
          catchError(() => EMPTY)
        )
      )
    )
  );

  markAllRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MessagingActions.markAllNotificationsRead),
      switchMap(() =>
        this.messagingService.markAllNotificationsRead().pipe(
          map(() => MessagingActions.markAllNotificationsReadSuccess()),
          catchError(() => EMPTY)
        )
      )
    )
  );
}
