
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  StatsGeography,
  StatsOverview,
  StatsProductsByCustomer,
  StatsTimeSaving,
  StatsTopCompanies,
  StatsTopProducts,
  StatsTrend,
} from './stats.state';
import { TrendParams } from '@app/features/services/stats.service';

export const StatsActions = createActionGroup({
  source: 'Stats',
  events: {

    // ─── OVERVIEW ───────────────────────────────────────────
    'Load Overview': emptyProps(),
    'Load Overview Success': props<{ overview: StatsOverview }>(),
    'Load Overview Failure': props<{ error: string }>(),

    // ─── ORDERS TREND ────────────────────────────────────────
    'Load Orders Trend': props<{ params?: TrendParams }>(),
    'Load Orders Trend Success': props<{ trend: StatsTrend }>(),
    'Load Orders Trend Failure': props<{ error: string }>(),

    // ─── TOP PRODUCTS ────────────────────────────────────────
    'Load Top Products': props<{ limit?: number }>(),
    'Load Top Products Success': props<{ topProducts: StatsTopProducts }>(),
    'Load Top Products Failure': props<{ error: string }>(),

    // ─── PRODUCTS BY CUSTOMER ────────────────────────────────
    'Load Products By Customer': props<{ limit?: number }>(),
    'Load Products By Customer Success': props<{ productsByCustomer: StatsProductsByCustomer }>(),
    'Load Products By Customer Failure': props<{ error: string }>(),

    // ─── GEOGRAPHY ───────────────────────────────────────────
    'Load Geography': emptyProps(),
    'Load Geography Success': props<{ geography: StatsGeography }>(),
    'Load Geography Failure': props<{ error: string }>(),

    // ─── TOP COMPANIES ───────────────────────────────────────
    'Load Top Companies': props<{ limit?: number }>(),
    'Load Top Companies Success': props<{ topCompanies: StatsTopCompanies }>(),
    'Load Top Companies Failure': props<{ error: string }>(),

    // ─── TIME SAVING ─────────────────────────────────────────
    'Load Time Saving': emptyProps(),
    'Load Time Saving Success': props<{ timeSaving: StatsTimeSaving }>(),
    'Load Time Saving Failure': props<{ error: string }>(),

    // ─── GENEL ───────────────────────────────────────────────
    // Dashboard açıldığında hepsini paralel tetikler
    'Load All Stats': props<{
      trendParams?: TrendParams;
      topLimit?: number;
    }>(),

    // State'i temizle (sayfa kapanınca)
    'Reset Stats': emptyProps(),
  },
});
