// store/stats/effects/stats.effects.ts

import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeAll, mergeMap, switchMap } from 'rxjs/operators';
import { of, from } from 'rxjs';
import { StatsActions } from './stats.actions';
import { StatsService } from '@app/features/services/stats.service';

@Injectable()
export class StatsEffects {
  private actions$ = inject(Actions);
  private statsService = inject(StatsService);

  // ─── LOAD ALL (paralel) ──────────────────────────────────
  // Dashboard açılınca tek dispatch ile hepsini tetikler
  loadAllStats$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadAllStats),
      switchMap(({ trendParams, topLimit }) =>
        from([
          StatsActions.loadOverview(),
          StatsActions.loadOrdersTrend({ params: trendParams ?? { period: 'monthly' } }),
          StatsActions.loadTopProducts({ limit: topLimit ?? 10 }),
          StatsActions.loadProductsByCustomer({ limit: topLimit ?? 10 }),
          StatsActions.loadGeography(),
          StatsActions.loadTopCompanies({ limit: topLimit ?? 10 }),
          StatsActions.loadTimeSaving(),
        ])
      )
    )
  );

  // ─── OVERVIEW ───────────────────────────────────────────
  loadOverview$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadOverview),
      switchMap(() =>
        this.statsService.getOverview().pipe(
          map((overview) => StatsActions.loadOverviewSuccess({ overview })),
          catchError((error) =>
            of(StatsActions.loadOverviewFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ─── ORDERS TREND ────────────────────────────────────────
  loadOrdersTrend$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadOrdersTrend),
      switchMap(({ params }) =>
        this.statsService.getOrdersTrend(params ?? {}).pipe(
          map((trend) => StatsActions.loadOrdersTrendSuccess({ trend })),
          catchError((error) =>
            of(StatsActions.loadOrdersTrendFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ─── TOP PRODUCTS ────────────────────────────────────────
  loadTopProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadTopProducts),
      switchMap(({ limit }) =>
        this.statsService.getTopProducts(limit ?? 10).pipe(
          map((topProducts) => StatsActions.loadTopProductsSuccess({ topProducts })),
          catchError((error) =>
            of(StatsActions.loadTopProductsFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ─── PRODUCTS BY CUSTOMER ────────────────────────────────
  loadProductsByCustomer$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadProductsByCustomer),
      switchMap(({ limit }) =>
        this.statsService.getProductsByCustomer(limit ?? 10).pipe(
          map((productsByCustomer) =>
            StatsActions.loadProductsByCustomerSuccess({ productsByCustomer })
          ),
          catchError((error) =>
            of(StatsActions.loadProductsByCustomerFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ─── GEOGRAPHY ───────────────────────────────────────────
  loadGeography$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadGeography),
      switchMap(() =>
        this.statsService.getGeography().pipe(
          map((geography) => StatsActions.loadGeographySuccess({ geography })),
          catchError((error) =>
            of(StatsActions.loadGeographyFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ─── TOP COMPANIES ───────────────────────────────────────
  loadTopCompanies$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadTopCompanies),
      switchMap(({ limit }) =>
        this.statsService.getTopCompanies(limit ?? 10).pipe(
          map((topCompanies) => StatsActions.loadTopCompaniesSuccess({ topCompanies })),
          catchError((error) =>
            of(StatsActions.loadTopCompaniesFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ─── TIME SAVING ─────────────────────────────────────────
  loadTimeSaving$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StatsActions.loadTimeSaving),
      switchMap(() =>
        this.statsService.getTimeSaving().pipe(
          map((timeSaving) => StatsActions.loadTimeSavingSuccess({ timeSaving })),
          catchError((error) =>
            of(StatsActions.loadTimeSavingFailure({ error: error.message }))
          )
        )
      )
    )
  );
}
