// features/stats/stats-dashboard.component.ts

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import { toSignal } from '@angular/core/rxjs-interop';

import { AppState } from '@app/store';
import { StatsActions } from '@app/store/stats/stats.actions';
import {
  selectAnyStatsLoading,
  selectBestMonth,
  selectGeographyData,
  selectGeographyMaxCount,
  selectOverviewKpi,
  selectProductsByCustomerData,
  selectTimeSavingByPeriod,
  selectTimeSavingConfig,
  selectTimeSavingSummary,
  selectTopCompaniesData,
  selectTopProductsData,
  selectTrendData,
  selectOverviewLoading,
  selectTrendLoading,
  selectTopProductsLoading,
  selectGeographyLoading,
  selectTopCompaniesLoading,
  selectTimeSavingLoading,
  selectProductsByCustomerLoading,
  selectOverviewError,
  selectTrendError,
  selectTopProductsError,
  selectGeographyError,
  selectTopCompaniesError,
  selectTimeSavingError,
  selectProductsByCustomerError,
} from '@app/store/stats/stats.selectors';
import { ISO2_TO_MAP_NAME } from './country-map-names';
import { TrendParams } from '@app/features/services/stats.service';

type TrendPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type StatsSection =
  | 'overview' | 'trend' | 'products' | 'customerProducts' | 'geography' | 'companies' | 'timeSaving';

const TOP_LIMIT = 10;

/** Dünya haritası (echarts formatı) uygulama içinde servis edilir; CDN'e bağımlılık yok. */
const WORLD_MAP_URL = 'assets/maps/world.json';


@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule,
    NgxEchartsModule,
  ],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
})
export class StatsDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private store = inject(Store<AppState>);
  private translate = inject(TranslateService);

  // ─── SELECTORS → SIGNALS ────────────────────────────────
  readonly anyLoading = toSignal(this.store.select(selectAnyStatsLoading), { initialValue: false });
  readonly overviewLoading = toSignal(this.store.select(selectOverviewLoading), { initialValue: true });
  readonly trendLoading = toSignal(this.store.select(selectTrendLoading), { initialValue: true });
  readonly productsLoading = toSignal(this.store.select(selectTopProductsLoading), { initialValue: true });
  readonly geoLoading = toSignal(this.store.select(selectGeographyLoading), { initialValue: true });
  readonly companiesLoading = toSignal(this.store.select(selectTopCompaniesLoading), { initialValue: true });
  readonly timeSavingLoading = toSignal(this.store.select(selectTimeSavingLoading), { initialValue: true });
  readonly customerProductsLoading = toSignal(this.store.select(selectProductsByCustomerLoading), { initialValue: true });

  readonly kpi = toSignal(this.store.select(selectOverviewKpi));
  readonly bestMonth = toSignal(this.store.select(selectBestMonth));
  readonly trendData = toSignal(this.store.select(selectTrendData), { initialValue: [] });
  readonly topProductsData = toSignal(this.store.select(selectTopProductsData), { initialValue: [] });
  readonly productsByCustomer = toSignal(this.store.select(selectProductsByCustomerData), { initialValue: [] });
  readonly geographyData = toSignal(this.store.select(selectGeographyData), { initialValue: [] });
  readonly geographyMax = toSignal(this.store.select(selectGeographyMaxCount), { initialValue: 0 });
  readonly topCompanies = toSignal(this.store.select(selectTopCompaniesData), { initialValue: [] });
  readonly timeSavingSummary = toSignal(this.store.select(selectTimeSavingSummary));
  readonly timeSavingPeriod = toSignal(this.store.select(selectTimeSavingByPeriod));
  readonly timeSavingConfig = toSignal(this.store.select(selectTimeSavingConfig));

  // ─── HATA DURUMLARI (boş veri ile "yüklenemedi" ayrımı için) ──
  readonly overviewError = toSignal(this.store.select(selectOverviewError), { initialValue: null });
  readonly trendError = toSignal(this.store.select(selectTrendError), { initialValue: null });
  readonly productsError = toSignal(this.store.select(selectTopProductsError), { initialValue: null });
  readonly geoError = toSignal(this.store.select(selectGeographyError), { initialValue: null });
  readonly companiesError = toSignal(this.store.select(selectTopCompaniesError), { initialValue: null });
  readonly timeSavingError = toSignal(this.store.select(selectTimeSavingError), { initialValue: null });
  readonly customerProductsError = toSignal(this.store.select(selectProductsByCustomerError), { initialValue: null });

  // ─── SELECTED TREND PERIOD ──────────────────────────────
  selectedPeriod = signal<TrendPeriod>('monthly');

  // ─── MAP REGISTERED ─────────────────────────────────────
  mapRegistered = signal(false);
  mapFailed = signal(false);

  // ─── CHART OPTIONS (computed) ───────────────────────────
  readonly trendChartOption = computed<EChartsOption>(() => {
    const data = this.trendData();
    const zoomable = data.length > 31;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: zoomable ? '14%' : '3%', containLabel: true },
      dataZoom: zoomable
        ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 4 }]
        : undefined,
      xAxis: {
        type: 'category',
        data: data.map((d) => d.label),
        axisLine: { lineStyle: { color: '#e0e0e0' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: this.translate.instant('STATS.ORDERS'),
          type: 'line',
          smooth: true,
          data: data.map((d) => d.count),
          lineStyle: { color: '#006A6A', width: 3 },
          itemStyle: { color: '#006A6A' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0,106,106,0.3)' },
                { offset: 1, color: 'rgba(0,106,106,0.02)' },
              ],
            },
          },
        },
      ],
    };
  });

  readonly topProductsChartOption = computed<EChartsOption>(() => {
    const data = [...this.topProductsData()].reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.product_name),
        axisLabel: { color: '#6b7280', fontSize: 10, width: 120, overflow: 'truncate' },
      },
      series: [
        {
          name: this.translate.instant('STATS.ORDERS'),
          type: 'bar',
          data: data.map((d) => d.total_quantity),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#004A4A' },
                { offset: 1, color: '#006A6A' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            color: '#6b7280',
            fontSize: 11,
          },
        },
      ],
    };
  });

  readonly topCompaniesChartOption = computed<EChartsOption>(() => {
    const data = [...this.topCompanies()].reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.company_name),
        axisLabel: { color: '#6b7280', fontSize: 11 },
      },
      series: [
        {
          name: this.translate.instant('STATS.ORDER_COUNT'),
          type: 'bar',
          data: data.map((d) => d.order_count),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#C0A670' },
                { offset: 1, color: '#D6BB86' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            color: '#6b7280',
            fontSize: 11,
          },
        },
      ],
    };
  });

  readonly geoChartOption = computed<EChartsOption>(() => {
    if (!this.mapRegistered()) return {};
    const data = this.geographyData();
    const max = this.geographyMax();

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) =>
          `${params.name}<br/>${this.translate.instant('STATS.ORDERS')}: <b>${isNaN(params.value) ? 0 : (params.value ?? 0)}</b>`,
      },
      visualMap: {
        min: 0,
        max: max || 1,
        left: 'left',
        bottom: '20px',
        text: [this.translate.instant('STATS.HIGH'), this.translate.instant('STATS.LOW')],
        inRange: { color: ['#e8f5f5', '#006A6A'] },
        textStyle: { color: '#6b7280', fontSize: 11 },
      },
      series: [
        {
          name: this.translate.instant('STATS.ORDER_DISTRIBUTION'),
          type: 'map',
          map: 'world',
          roam: true,
          scaleLimit: {
            min: 1,
            max: 5,
          },
          zoom: 0.2,
          emphasis: {
            itemStyle: { areaColor: '#D6BB86' },
            label: { show: true, color: '#004A4A', fontWeight: 'bold' },
          },
          data: data.map((d) => ({
            name: this.mapRegionName(d.country, d.country_code),
            value: d.order_count ?? 0,
          })),
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 0.5,
          },
        },
      ],
      animation: false,
    };
  });

  // ─── LIFECYCLE ───────────────────────────────────────────
  ngOnInit(): void {
    this.store.dispatch(
      StatsActions.loadAllStats({
        trendParams: this.trendParamsFor('monthly'),
        topLimit: TOP_LIMIT,
      })
    );
  }

  ngAfterViewInit(): void {
    this.loadWorldMap();
  }

  ngOnDestroy(): void {
    this.store.dispatch(StatsActions.resetStats());
  }

  /** Harita JSON'u uygulama içinden yüklenir; başarısız olursa kullanıcıya yeniden dene seçeneği sunulur. */
  loadWorldMap(): void {
    this.mapFailed.set(false);
    if (echarts.getMap('world')) {
      this.mapRegistered.set(true);
      return;
    }
    fetch(WORLD_MAP_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((worldJson) => {
        echarts.registerMap('world', worldJson);
        this.mapRegistered.set(true);
      })
      .catch(() => this.mapFailed.set(true));
  }

  // ─── PERIOD CHANGE ───────────────────────────────────────
  onPeriodChange(period: TrendPeriod): void {
    this.selectedPeriod.set(period);
    this.store.dispatch(
      StatsActions.loadOrdersTrend({ params: this.trendParamsFor(period) })
    );
  }

  /**
   * Günlük ve haftalık görünümde tüm geçmişi çizmek okunaksız ve ağır olur;
   * bu yüzden varsayılan olarak son 90 gün / 52 hafta istenir.
   */
  private trendParamsFor(period: TrendPeriod): TrendParams {
    const days = period === 'daily' ? 90 : period === 'weekly' ? 364 : 0;
    if (!days) return { period };
    const from = new Date();
    from.setDate(from.getDate() - days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      period,
      date_from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    };
  }

  // ─── YENİDEN DENE ────────────────────────────────────────
  retry(section: StatsSection): void {
    switch (section) {
      case 'overview':
        this.store.dispatch(StatsActions.loadOverview());
        break;
      case 'trend':
        this.store.dispatch(
          StatsActions.loadOrdersTrend({ params: this.trendParamsFor(this.selectedPeriod()) })
        );
        break;
      case 'products':
        this.store.dispatch(StatsActions.loadTopProducts({ limit: TOP_LIMIT }));
        break;
      case 'customerProducts':
        this.store.dispatch(StatsActions.loadProductsByCustomer({ limit: TOP_LIMIT }));
        break;
      case 'geography':
        this.store.dispatch(StatsActions.loadGeography());
        break;
      case 'companies':
        this.store.dispatch(StatsActions.loadTopCompanies({ limit: TOP_LIMIT }));
        break;
      case 'timeSaving':
        this.store.dispatch(StatsActions.loadTimeSaving());
        break;
    }
  }

  getFlagUrl(code: string): string {
    if (!code) return '';
    return `https://flagcdn.com/w20/${code.toLowerCase()}.png`;
  }

  onFlagError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  // ─── HELPERS ─────────────────────────────────────────────
  formatHours(hours: number): string {
    const hUnit = this.translate.instant('STATS.UNIT_HOUR');
    const mUnit = this.translate.instant('STATS.UNIT_MINUTE');
    if (!hours) return `0${hUnit}`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}${hUnit} ${m}${mUnit}` : `${h}${hUnit}`;
  }

  /** '2026-10' → '2026 Ekim' (seçili dile göre). */
  formatMonth(value: string | null | undefined): string {
    if (!value) return '-';
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) return value;
    const lang = this.translate.currentLang || this.translate.defaultLang || 'tr';
    return new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  }

  /** Backend ülke kodunu echarts harita bölge adına çevirir; bulunamazsa adı düzenleyerek dener. */
  private mapRegionName(country: string, code: string | null): string {
    const byCode = code ? ISO2_TO_MAP_NAME[code.toUpperCase()] : undefined;
    return byCode ?? this.toTitleCase(country);
  }

  toTitleCase(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
