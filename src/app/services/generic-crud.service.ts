import { inject, Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({
  providedIn: 'root'
})
export class GenericCrudService<T> {
  protected apiUrl: string = '';
  api = inject(ApiService);

  constructor(
    protected http: HttpClient,
    @Inject('ENDPOINT') protected endpoint: string
  ) {
  }
  protected ensureApiUrl(): void {
    // Eğer apiUrl daha önce set edilmemişse ve settings mevcutsa
    if (!this.apiUrl && this.api.getApiUrl()) {
      const formattedEndpoint = this.endpoint.endsWith('/') ? this.endpoint : `${this.endpoint}/`;
      this.apiUrl = `${this.api.getApiUrl()}/${formattedEndpoint}`;
    }
  }
  /**
   * Tüm kayıtları getiren metod, filtreleme ve sıralama destekler
   * @param params Filtre ve sıralama parametreleri
   * @returns Sayfalandırılmış sonuç listesi
   */
  getAll(params?: any): Observable<Page<T>> {

    this.ensureApiUrl();


    let httpParams = new HttpParams();

    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }

    return this.http.get<Page<T>>(this.apiUrl, { params: httpParams }).pipe(
      // Veriyi formatla
      map(response => this.formatNumberValues(response)),
      tap(response => {

        if (response && response.results) {

          if (response.results.length > 0) {

          }
        }

        // Sıralama parametresi varsa kontrol et
        if (params && params.ordering) {

        }
      })
    );
  }

  /**
   * ID'ye göre tek bir kaydı getiren metod
   * @param id Kaydın ID'si
   * @returns Kaydın detayları
   */
  getById(id: number | string): Observable<T> {
    this.ensureApiUrl();
    return this.http.get<T>(`${this.apiUrl}${id}/`).pipe(
      // Veriyi formatla
      map(response => this.formatSingleItem(response)),
      tap(response => {

      })
    );
  }

  /**
   * Yeni kayıt oluşturan metod
   * @param item Oluşturulacak kaydın verileri
   * @returns Oluşturulan kayıt
   */
  create(item: Partial<T>): Observable<T> {
    this.ensureApiUrl();
    return this.http.post<T>(this.apiUrl, item).pipe(
      // Veriyi formatla
      map(response => this.formatSingleItem(response)),
      tap(response => {

      })
    );
  }

  /**
   * Mevcut kaydı güncelleyen metod
   * @param id Güncellenecek kaydın ID'si
   * @param item Güncellenmiş veriler
   * @returns Güncellenmiş kayıt
   */
  update(id: number | string, item: Partial<T>): Observable<T> {

    this.ensureApiUrl();
    return this.http.put<T>(`${this.apiUrl}${id}/`, item).pipe(
      // Veriyi formatla
      map(response => this.formatSingleItem(response)),
      tap(response => {

      })
    );
  }

  /**
   * Mevcut kaydı kısmi güncelleyen metod
   * @param id Güncellenecek kaydın ID'si
   * @param item Güncellenecek alanlar ve değerleri
   * @returns Güncellenmiş kayıt
   */
  partialUpdate(id: number | string, item: Partial<T>): Observable<T> {

    this.ensureApiUrl();
    return this.http.patch<T>(`${this.apiUrl}${id}/`, item).pipe(
      // Veriyi formatla
      map(response => this.formatSingleItem(response)),
      tap(response => {

      })
    );
  }

  /**
   * Kaydı silen metod
   * @param id Silinecek kaydın ID'si
   * @returns Silme işlemi sonucu
   */
  delete(id: number | string): Observable<any> {
    this.ensureApiUrl();

    return this.http.delete(`${this.apiUrl}${id}/`).pipe(
      tap(response => {

      })
    );
  }

  /**
   * Sayısal değerleri formatlayan yardımcı metod
   * @param value Formatlanacak değer
   * @returns Formatlanmış değer
   */
  protected formatNumber(value: any): any {
    // Değer yoksa veya sayı değilse olduğu gibi döndür
    if (value === null || value === undefined || value === '' ||
      (typeof value !== 'number' && (typeof value === 'string' && isNaN(Number(value))))) {
      return value;
    }

    // Sayıya çevir
    const numValue = Number(value);

    // Tam sayı ise (1.0, 500.0, 1000.0 gibi)
    if (Number.isInteger(numValue)) {
      return numValue.toString();
    }

    // Ondalık kısmı varsa
    if (numValue % 1 !== 0) {
      // Ondalık kısmı 3 basamakla sınırla (yukarı yuvarlama)
      return numValue.toFixed(3).replace(/\.?0+$/, ''); // Sondaki sıfırları temizle
    }

    // Diğer durumlar için olduğu gibi döndür
    return value;
  }

  /**
   * Tek bir öğedeki tüm sayısal değerleri formatlayan metod
   * @param item Formatlanacak öğe
   * @returns Formatlanmış öğe
   */
  protected formatSingleItem(item: any): any {
    if (!item || typeof item !== 'object') {
      return item;
    }

    // Kopyalama ve güvenli tip dönüşümü için
    const result = { ...item };

    // Her özellik için formatlama uygula
    this.processObject(result);

    return result;
  }

  /**
   * Objeler içindeki tüm sayısal değerleri dolaşıp formatlayan metod
   * @param obj Formatlanacak obje
   */
  private processObject(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Objenin tüm özellikleri için
    Object.keys(obj).forEach(key => {
      const value = obj[key];

      if (value === null || value === undefined) {
        return;
      }

      // Eğer değer bir obje ise, içine gir
      if (typeof value === 'object' && !Array.isArray(value)) {
        this.processObject(value);
      }
      // Eğer değer bir dizi ise, her elemanı işle
      else if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'object') {
            this.processObject(item);
          } else {
            // Sayısal dizi elemanları için doğrudan formatlama
            const index = value.indexOf(item);
            value[index] = this.formatNumber(item);
          }
        });
      }
      // Sayısal değer ise formatla
      else if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
        obj[key] = this.formatNumber(value);
      }
    });
  }

  /**
   * Sayfalanmış veriyi formatlayan metod
   * @param page Sayfalanmış veri
   * @returns Formatlanmış sayfalanmış veri
   */
  protected formatNumberValues(page: Page<T>): Page<T> {
    // Yanıtın kopyasını oluştur
    const formattedPage: Page<T> = {
      count: page.count,
      next: page.next,
      previous: page.previous,
      results: [...page.results]
    };

    // Her sonuç için formatla
    formattedPage.results = formattedPage.results.map(item => this.formatSingleItem(item));

    return formattedPage;
  }
}
