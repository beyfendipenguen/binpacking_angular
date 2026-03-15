export interface StatsOverviewKpi {
  total_orders: number;
  total_products: number;
  total_customers: number;
  total_countries: number;
}

export interface StatsBestMonth {
  month: string;
  order_count: number;
}

export interface StatsOverview {
  kpi: StatsOverviewKpi;
  best_month: StatsBestMonth | null;
}

export interface StatsTrendItem {
  label: string;
  count: number;
}

export interface StatsTrend {
  period: string;
  date_from: string | null;
  date_to: string | null;
  data: StatsTrendItem[];
}

export interface StatsTopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  order_count: number;
}

export interface StatsTopProducts {
  limit: number;
  data: StatsTopProduct[];
}

export interface StatsProductByCustomer {
  company_id: string;
  company_name: string;
  country_code: string | null;
  top_product: {
    product_id: string;
    product_name: string;
    total_quantity: number;
  };
}

export interface StatsProductsByCustomer {
  limit: number;
  data: StatsProductByCustomer[];
}

export interface StatsCountry {
  country: string;
  country_code: string | null;
  order_count: number;
}

export interface StatsGeography {
  total_countries: number;
  max_order_count: number;
  data: StatsCountry[];
}

export interface StatsTopCompany {
  company_id: string;
  company_name: string;
  country: string;
  country_code: string;
  order_count: number;
  total_quantity: number;
}

export interface StatsTopCompanies {
  limit: number;
  data: StatsTopCompany[];
}

export interface StatsTimeSavingConfig {
  manual_placement_minutes: number;
  manual_report_minutes: number;
  total_manual_per_order_minutes: number;
}

export interface StatsTimeSavingSummary {
  total_orders_analyzed: number;
  total_saved_hours: number;
  total_saved_minutes: number;
  avg_saved_minutes_per_order: number;
  avg_system_minutes_per_order: number;
  guaranteed_report_saving_hours: number;
}

export interface StatsTimeSavingPeriod {
  orders: number;
  saved_hours: number;
  saved_minutes: number;
}

export interface StatsTimeSaving {
  config: StatsTimeSavingConfig;
  summary: StatsTimeSavingSummary;
  by_period: {
    this_month: StatsTimeSavingPeriod;
    this_year: StatsTimeSavingPeriod;
  };
}

// Loading & Error state her endpoint için ayrı
export interface StatsLoadingState {
  loading: boolean;
  error: string | null;
}

export interface StatsState {
  overview: StatsOverview | null;
  trend: StatsTrend | null;
  topProducts: StatsTopProducts | null;
  productsByCustomer: StatsProductsByCustomer | null;
  geography: StatsGeography | null;
  topCompanies: StatsTopCompanies | null;
  timeSaving: StatsTimeSaving | null;

  // Her endpoint için ayrı loading/error
  loadingStates: {
    overview: StatsLoadingState;
    trend: StatsLoadingState;
    topProducts: StatsLoadingState;
    productsByCustomer: StatsLoadingState;
    geography: StatsLoadingState;
    topCompanies: StatsLoadingState;
    timeSaving: StatsLoadingState;
  };
}

const initialLoadingState: StatsLoadingState = {
  loading: false,
  error: null,
};

export const initialStatsState: StatsState = {
  overview: null,
  trend: null,
  topProducts: null,
  productsByCustomer: null,
  geography: null,
  topCompanies: null,
  timeSaving: null,

  loadingStates: {
    overview: { ...initialLoadingState },
    trend: { ...initialLoadingState },
    topProducts: { ...initialLoadingState },
    productsByCustomer: { ...initialLoadingState },
    geography: { ...initialLoadingState },
    topCompanies: { ...initialLoadingState },
    timeSaving: { ...initialLoadingState },
  },
};
