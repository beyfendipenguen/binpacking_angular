import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import {
  StatsGeography,
  StatsOverview,
  StatsProductsByCustomer,
  StatsTimeSaving,
  StatsTopCompanies,
  StatsTopProducts,
  StatsTrend,
} from '@app/store/stats/stats.state';

export interface TrendParams {
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  date_from?: string;
  date_to?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private http = inject(HttpClient);
  private api = inject(ApiService);

  private get baseUrl(): string {
    return `${this.api.getApiUrl()}/stats`;
  }

  getOverview(): Observable<StatsOverview> {
    return this.http.get<StatsOverview>(`${this.baseUrl}/overview/`);
  }

  getOrdersTrend(params: TrendParams = {}): Observable<StatsTrend> {
    let httpParams = new HttpParams();
    if (params.period) httpParams = httpParams.set('period', params.period);
    if (params.date_from) httpParams = httpParams.set('date_from', params.date_from);
    if (params.date_to) httpParams = httpParams.set('date_to', params.date_to);
    return this.http.get<StatsTrend>(`${this.baseUrl}/orders/trend/`, { params: httpParams });
  }

  getTopProducts(limit: number = 10): Observable<StatsTopProducts> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<StatsTopProducts>(`${this.baseUrl}/products/top/`, { params });
  }

  getProductsByCustomer(limit: number = 10): Observable<StatsProductsByCustomer> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<StatsProductsByCustomer>(`${this.baseUrl}/products/by-customer/`, { params });
  }

  getGeography(): Observable<StatsGeography> {
    return this.http.get<StatsGeography>(`${this.baseUrl}/geography/`);
  }

  getTopCompanies(limit: number = 10): Observable<StatsTopCompanies> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<StatsTopCompanies>(`${this.baseUrl}/companies/top/`, { params });
  }

  getTimeSaving(): Observable<StatsTimeSaving> {
    return this.http.get<StatsTimeSaving>(`${this.baseUrl}/time-saving/`);
  }
}
