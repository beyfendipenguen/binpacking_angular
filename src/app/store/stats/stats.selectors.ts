// store/stats/stats.selectors.ts

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { StatsState } from './stats.state';

// ─── FEATURE SELECTOR ────────────────────────────────────
export const selectStatsState = createFeatureSelector<StatsState>('stats');

// ─── LOADING STATES ──────────────────────────────────────
export const selectStatsLoadingStates = createSelector(
  selectStatsState,
  (state) => state.loadingStates
);

export const selectOverviewLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.overview.loading
);

export const selectTrendLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.trend.loading
);

export const selectTopProductsLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.topProducts.loading
);

export const selectProductsByCustomerLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.productsByCustomer.loading
);

export const selectGeographyLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.geography.loading
);

export const selectTopCompaniesLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.topCompanies.loading
);

export const selectTimeSavingLoading = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.timeSaving.loading
);

// Tüm endpointler yüklenirken true döner (dashboard skeleton için)
export const selectAnyStatsLoading = createSelector(
  selectStatsLoadingStates,
  (ls) =>
    ls.overview.loading ||
    ls.trend.loading ||
    ls.topProducts.loading ||
    ls.productsByCustomer.loading ||
    ls.geography.loading ||
    ls.topCompanies.loading ||
    ls.timeSaving.loading
);

// ─── ERROR STATES ────────────────────────────────────────
export const selectOverviewError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.overview.error
);

export const selectTrendError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.trend.error
);

export const selectTopProductsError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.topProducts.error
);

export const selectProductsByCustomerError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.productsByCustomer.error
);

export const selectGeographyError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.geography.error
);

export const selectTopCompaniesError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.topCompanies.error
);

export const selectTimeSavingError = createSelector(
  selectStatsLoadingStates,
  (ls) => ls.timeSaving.error
);

// ─── DATA SELECTORS ──────────────────────────────────────
export const selectOverview = createSelector(
  selectStatsState,
  (state) => state.overview
);

export const selectOverviewKpi = createSelector(
  selectOverview,
  (overview) => overview?.kpi ?? null
);

export const selectBestMonth = createSelector(
  selectOverview,
  (overview) => overview?.best_month ?? null
);

export const selectTrend = createSelector(
  selectStatsState,
  (state) => state.trend
);

export const selectTrendData = createSelector(
  selectTrend,
  (trend) => trend?.data ?? []
);

export const selectTopProducts = createSelector(
  selectStatsState,
  (state) => state.topProducts
);

export const selectTopProductsData = createSelector(
  selectTopProducts,
  (topProducts) => topProducts?.data ?? []
);

export const selectProductsByCustomer = createSelector(
  selectStatsState,
  (state) => state.productsByCustomer
);

export const selectProductsByCustomerData = createSelector(
  selectProductsByCustomer,
  (productsByCustomer) => productsByCustomer?.data ?? []
);

export const selectGeography = createSelector(
  selectStatsState,
  (state) => state.geography
);

export const selectGeographyData = createSelector(
  selectGeography,
  (geography) => geography?.data ?? []
);

export const selectGeographyMaxCount = createSelector(
  selectGeography,
  (geography) => geography?.max_order_count ?? 0
);

export const selectTopCompanies = createSelector(
  selectStatsState,
  (state) => state.topCompanies
);

export const selectTopCompaniesData = createSelector(
  selectTopCompanies,
  (topCompanies) => topCompanies?.data ?? []
);

export const selectTimeSaving = createSelector(
  selectStatsState,
  (state) => state.timeSaving
);

export const selectTimeSavingSummary = createSelector(
  selectTimeSaving,
  (timeSaving) => timeSaving?.summary ?? null
);

export const selectTimeSavingByPeriod = createSelector(
  selectTimeSaving,
  (timeSaving) => timeSaving?.by_period ?? null
);

export const selectTimeSavingConfig = createSelector(
  selectTimeSaving,
  (timeSaving) => timeSaving?.config ?? null
);
