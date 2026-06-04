import { HttpClient, HttpParams, HttpContext } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { SKIP_LOADING } from "@app/shared/loading/skip-loading.token";
import { AppState, selectOrderDetails } from "@app/store";
import { Store } from "@ngrx/store";
import { Observable, map, catchError, of, take, switchMap } from "rxjs";
import { BulkUploadResponse, Product } from "../interfaces/product.interface";

@Injectable({
  providedIn: 'root',
})
export class ProductService extends GenericCrudService<Product> {
  private readonly store = inject(Store<AppState>);
  constructor(http: HttpClient) {
    super(http, 'products/products');
  }

  bulkUpload(file: File): Observable<BulkUploadResponse> {
    this.ensureApiUrl();
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<BulkUploadResponse>(
      `${this.apiUrl}bulk-upload/`,
      formData
    );
  }

  /**
   * Ürün arama metodu - Backend'den gelen sonuçları sınırlandırır
   * @param query Arama sorgusu
   * @param limit Maksimum sonuç sayısı (varsayılan 10)
   */
  searchProducts(query: string, limit: number = 10): Observable<Product[]> {
    this.ensureApiUrl();

    if (!query || query.trim().length < 2) {
      return of([]);
    }

    // 1️⃣ Önce store'da ara
    return this.store.select(selectOrderDetails).pipe(
      take(1),
      switchMap((orderDetails) => {
        const localResults = this.searchInLocalProducts(query, orderDetails);

        if (localResults.length > 0) {
          return of(localResults);
        }

        // 2️⃣ Store'da yoksa backend'e git
        if (query.length < 3) return of([]);

        let params = new HttpParams()
          .set('search', query)
          .set('limit', limit.toString());
        let context = new HttpContext().set(SKIP_LOADING, true);

        return this.http.get<any>(`${this.apiUrl}`, { params, context }).pipe(
          map((response) => response?.results || []),
          catchError(() => of([]))
        );
      })
    );
  }

  getByIds(ids: string[]): Observable<Product[]> {
    this.ensureApiUrl();
    return this.http.post<Product[]>(`${this.apiUrl}by-ids/`, { ids });
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

  exportProducts(filterParams: { [key: string]: string } = {}): Observable<void> {
    this.ensureApiUrl();

    let params = new HttpParams();
    Object.entries(filterParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    });

    return this.http.get(
      `${this.apiUrl}export/`,
      {
        params: params,
        responseType: 'blob' as 'json'
      }
    ).pipe(
      map((response: any) => {
        const blob = new Blob([response], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'products_export.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      })
    );
  }

  bulkUpdate(file: File): Observable<any> {
    this.ensureApiUrl();
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.apiUrl}bulk-update/`, formData);
  }

  checkUsage(id: string): Observable<{ in_use: boolean; orders: { id: string; name: string }[] }> {
    this.ensureApiUrl();
    const context = new HttpContext().set(SKIP_LOADING, true);
    return this.http.get<any>(`${this.apiUrl}${id}/check-usage/`, { context });
  }
}
