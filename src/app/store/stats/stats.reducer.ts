// store/stats/reducers/stats.reducer.ts

import { createReducer, on } from '@ngrx/store';
import { initialStatsState } from './stats.state';
import { StatsActions } from './stats.actions';

export const statsReducer = createReducer(
  initialStatsState,

  // ─── OVERVIEW ───────────────────────────────────────────
  on(StatsActions.loadOverview, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      overview: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadOverviewSuccess, (state, { overview }) => ({
    ...state,
    overview,
    loadingStates: {
      ...state.loadingStates,
      overview: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadOverviewFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      overview: { loading: false, error },
    },
  })),

  // ─── ORDERS TREND ────────────────────────────────────────
  on(StatsActions.loadOrdersTrend, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      trend: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadOrdersTrendSuccess, (state, { trend }) => ({
    ...state,
    trend,
    loadingStates: {
      ...state.loadingStates,
      trend: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadOrdersTrendFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      trend: { loading: false, error },
    },
  })),

  // ─── TOP PRODUCTS ────────────────────────────────────────
  on(StatsActions.loadTopProducts, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      topProducts: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadTopProductsSuccess, (state, { topProducts }) => ({
    ...state,
    topProducts,
    loadingStates: {
      ...state.loadingStates,
      topProducts: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadTopProductsFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      topProducts: { loading: false, error },
    },
  })),

  // ─── PRODUCTS BY CUSTOMER ────────────────────────────────
  on(StatsActions.loadProductsByCustomer, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      productsByCustomer: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadProductsByCustomerSuccess, (state, { productsByCustomer }) => ({
    ...state,
    productsByCustomer,
    loadingStates: {
      ...state.loadingStates,
      productsByCustomer: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadProductsByCustomerFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      productsByCustomer: { loading: false, error },
    },
  })),

  // ─── GEOGRAPHY ───────────────────────────────────────────
  on(StatsActions.loadGeography, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      geography: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadGeographySuccess, (state, { geography }) => ({
    ...state,
    geography,
    loadingStates: {
      ...state.loadingStates,
      geography: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadGeographyFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      geography: { loading: false, error },
    },
  })),

  // ─── TOP COMPANIES ───────────────────────────────────────
  on(StatsActions.loadTopCompanies, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      topCompanies: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadTopCompaniesSuccess, (state, { topCompanies }) => ({
    ...state,
    topCompanies,
    loadingStates: {
      ...state.loadingStates,
      topCompanies: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadTopCompaniesFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      topCompanies: { loading: false, error },
    },
  })),

  // ─── TIME SAVING ─────────────────────────────────────────
  on(StatsActions.loadTimeSaving, (state) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      timeSaving: { loading: true, error: null },
    },
  })),
  on(StatsActions.loadTimeSavingSuccess, (state, { timeSaving }) => ({
    ...state,
    timeSaving,
    loadingStates: {
      ...state.loadingStates,
      timeSaving: { loading: false, error: null },
    },
  })),
  on(StatsActions.loadTimeSavingFailure, (state, { error }) => ({
    ...state,
    loadingStates: {
      ...state.loadingStates,
      timeSaving: { loading: false, error },
    },
  })),

  // ─── RESET ───────────────────────────────────────────────
  on(StatsActions.resetStats, () => initialStatsState),
);
