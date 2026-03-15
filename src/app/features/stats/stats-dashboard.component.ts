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
} from '@app/store/stats/stats.selectors';


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

  // ─── SELECTED TREND PERIOD ──────────────────────────────
  selectedPeriod = signal<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  // ─── MAP REGISTERED ─────────────────────────────────────
  mapRegistered = signal(false);

  // ─── CHART OPTIONS (computed) ───────────────────────────
  readonly trendChartOption = computed<EChartsOption>(() => {
    const data = this.trendData();
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
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
          name: this.translate.instant('APPS.ORDERS'),
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
          name: this.translate.instant('APPS.ORDERS'),
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
          name: this.translate.instant('APPS.ORDER_COUNT'),
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
          `${params.name}<br/>${this.translate.instant('MODELS.ORDER')}: <b>${isNaN(params.value) ? 0 : (params.value ?? 0)}</b>`,
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
            // ← BURASI DEĞİŞTİ: her kelimenin ilk harfi büyük
            name: this.toTitleCase(d.country),
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
        trendParams: { period: 'monthly' },
        topLimit: 10,
      })
    );
  }

  ngAfterViewInit(): void {
    // World map JSON'u CDN'den al ve register et
    fetch('https://cdn.jsdelivr.net/npm/echarts/map/json/world.json')
      .then((r) => r.json())
      .then((worldJson) => {
        echarts.registerMap('world', worldJson);
        this.mapRegistered.set(true);
      })
      .catch(() => {

      });
  }

  ngOnDestroy(): void {
    this.store.dispatch(StatsActions.resetStats());
  }

  // ─── PERIOD CHANGE ───────────────────────────────────────
  onPeriodChange(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): void {
    this.selectedPeriod.set(period);
    this.store.dispatch(
      StatsActions.loadOrdersTrend({ params: { period } })
    );
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
    if (!hours) return '0s';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}s ${m}dk` : `${h}s`;
  }

  private readonly COUNTRY_NAME_MAP: Record<string, string> = {
    'turkey': 'Turkey',
    'türkiye': 'Turkey',
    'turkiye': 'Turkey',
    'russia': 'Russia',
    'russian federation': 'Russia',
    'south korea': 'South Korea',
    'north korea': 'North Korea',
    'united states': 'United States',
    'usa': 'United States',
    'united kingdom': 'United Kingdom',
    'uk': 'United Kingdom',
    'united arab emirates': 'United Arab Emirates',
    'uae': 'United Arab Emirates',
  };
  toTitleCase(str: string): string {
    if (!str) return '';
    const lower = str.toLowerCase().trim();
    // Önce mapping'e bak
    if (this.COUNTRY_NAME_MAP[lower]) {
      return this.COUNTRY_NAME_MAP[lower];
    }
    // Yoksa genel title case
    return lower
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
