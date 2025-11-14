import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap, take } from 'rxjs';
import { GenericCrudService } from '../../../services/generic-crud.service';
import { Product } from '../../../models/product.interface';
import { SKIP_LOADING } from '../../../components/loading/skip-loading.token';
import { Store } from '@ngrx/store';
import { AppState, selectStep1OrderDetails } from '../../../store';

@Injectable({
  providedIn: 'root',
})
export class ProductService extends GenericCrudService<Product> {
  private readonly store = inject(Store<AppState>);
  constructor(http: HttpClient) {
    super(http, 'products/products');
  }
  /**
   * Ürün arama metodu - Backend'den gelen sonuçları sınırlandırır
   * @param query Arama sorgusu
   * @param limit Maksimum sonuç sayısı (varsayılan 10)
   */
  searchProducts(query: string, limit: number = 10): Observable<any[]> {
    // Çok kısa sorgular için boş sonuç döndür (backend'i meşgul etmemek için)
    this.ensureApiUrl();
    if (!query || query.length < 3) {
      return new Observable((observer) => {
        observer.next([]);
        observer.complete();
      });
    }

    // Arama sonuçlarını sınırlandırmak için limit parametresi ekleyin
    let params = new HttpParams()
      .set('search', query)
      .set('limit', limit.toString());
    let context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<any>(`${this.apiUrl}`, { params, context }).pipe(
      map((response) => {
        // API'den bir sayfalama yanıtı gelirse (paginated response) "results" alanını kullan
        if (response && response.results) {
          return response.results;
        }
        // Doğrudan bir dizi gelirse, onu kullan
        return Array.isArray(response) ? response : [];
      }),
      catchError((error) => {
        throw error;
      })
    );
  }

  searchProductsWithParsedQuery(
    query: string,
    limit: number = 10
  ): Observable<any[]> {
    this.ensureApiUrl();

    if (!query || query.trim().length < 2) {
      return of([]);
    }

    // 1️⃣ İlk önce store'daki orderDetails'lerde ara
    return this.store.select(selectStep1OrderDetails).pipe(
      take(1), // Sadece bir kez oku
      switchMap((orderDetails) => {
        const localResults = this.searchInLocalProducts(query, orderDetails);

        if (localResults.length > 0) {
          // Store'da bulundu, backend'e gitme
          return of(localResults);
        }

        // 2️⃣ Store'da bulunamadı, backend'e git
        const parsedParams = this.parseProductQuery(query);

        if (Object.keys(parsedParams).length === 0) {
          return of([]);
        }

        let params = new HttpParams().set('limit', limit.toString());

        Object.keys(parsedParams).forEach((key) => {
          if (parsedParams[key]) {
            params = params.set(key, parsedParams[key]);
          }
        });

        let context = new HttpContext().set(SKIP_LOADING, true);

        return this.http.get<any>(`${this.apiUrl}`, { params, context }).pipe(
          map((response) => response?.results || []),
          catchError((error) => {
            throw error;
          })
        );
      })
    );
  }

  private parseProductQuery(query: string): any {
    const trimmedQuery = query.trim();
    const params: any = {};

    // Boşluk ve nokta kontrolü
    const hasDot = trimmedQuery.includes('.');
    const hasSpace = trimmedQuery.includes(' ');

    // Parçalara ayır
    const parts = hasDot
      ? trimmedQuery.split('.').filter((p) => p.length > 0)
      : trimmedQuery.split(/\s+/).filter((p) => p.length > 0);

    // Tüm parçalar sayı mı kontrol et
    const allNumbers = parts.every((p) => !isNaN(Number(p)));

    // SENARYO 1: Sadece sayılar
    if (allNumbers) {
      if (parts.length === 1) {
        // Tek sayı → hem width hem depth (OR mantığı - backend desteği gerekli)
        // Şimdilik her ikisini de ekleyelim, backend düzenlemesi gerekebilir
        params['dimension_search'] = parts[0]; // Özel parametre
      } else if (parts.length === 2) {
        // İki sayı → width ve depth
        params['dimension.width'] = parts[0];
        params['dimension.depth'] = parts[1];
      } else if (parts.length === 4) {
        // Dört parametre → type.code.width.depth (nokta ile)
        if (hasDot) {
          params['product_type.type'] = parts[0].toUpperCase();
          params['product_type.code'] = parts[1].toUpperCase();
          params['dimension.width'] = parts[2];
          params['dimension.depth'] = parts[3];
        }
      }
      return params;
    }

    // SENARYO 2: Sadece text (sayı yok)
    const hasAnyNumber = parts.some((p) => !isNaN(Number(p)));
    if (!hasAnyNumber) {
      // Sadece text → type_name'de ara
      params['type_name'] = trimmedQuery;
      return params;
    }

    // SENARYO 3: Karışık (hem text hem sayı)
    if (hasDot) {
      // Nokta formatı: type.code.width.depth
      if (parts[0]) params['product_type.type'] = parts[0].toUpperCase();
      if (parts[1]) params['product_type.code'] = parts[1].toUpperCase();
      if (parts[2]) params['dimension.width'] = parts[2];
      if (parts[3]) params['dimension.depth'] = parts[3];
    } else {
      // Boşluk formatı: code type width depth
      if (parts[0]) params['product_type.code'] = parts[0].toUpperCase();
      if (parts[1]) params['product_type.type'] = parts[1].toUpperCase();
      if (parts[2]) params['dimension.width'] = parts[2];
      if (parts[3]) params['dimension.depth'] = parts[3];
    }

    return params;
  }

  // Yardımcı metod
  private searchInLocalProducts(query: string, orderDetails: any[]): any[] {
    if (!orderDetails || orderDetails.length === 0) {
      return [];
    }

    // Query'i küçük harfe çevir
    const lowerQuery = query.toLowerCase().trim();

    // OrderDetails'teki ürünlerde ara
    const matchedProducts = orderDetails
      .map((detail) => detail.product)
      .filter((product) => {
        // Name ile eşleşme kontrolü
        if (product.name && product.name.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Product type code ile eşleşme
        if (
          product.product_type?.code &&
          product.product_type.code.toLowerCase().includes(lowerQuery)
        ) {
          return true;
        }

        // Product type type ile eşleşme
        if (
          product.product_type?.type &&
          product.product_type.type.toLowerCase().includes(lowerQuery)
        ) {
          return true;
        }

        return false;
      });

    // Unique products (aynı ürün birden fazla orderDetail'de olabilir)
    const uniqueProducts = matchedProducts.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
    );

    return uniqueProducts;
  }
}
