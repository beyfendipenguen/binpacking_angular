import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { catchError, map, Observable } from 'rxjs';
import { GenericCrudService } from '../../../services/generic-crud.service';
import { Product } from '../../../models/product.interface';
import { SKIP_LOADING } from '../../../components/loading/skip-loading.token';

@Injectable({
  providedIn: 'root'
})
export class ProductService extends GenericCrudService<Product> {
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
        return new Observable(observer => {
          observer.next([]);
          observer.complete();
        });
      }

      // Arama sonuçlarını sınırlandırmak için limit parametresi ekleyin
      let params = new HttpParams()
        .set('search', query)
        .set('limit', limit.toString());
      let context = new HttpContext().set(SKIP_LOADING,true)
      return this.http.get<any>(`${this.apiUrl}`, { params,context })
        .pipe(
          map(response => {
            // API'den bir sayfalama yanıtı gelirse (paginated response) "results" alanını kullan
            if (response && response.results) {
              return response.results;
            }
            // Doğrudan bir dizi gelirse, onu kullan
            return Array.isArray(response) ? response : [];
          }),
          catchError(error => {
            throw error;
          })
        );
    }

    /**
     * Hacim değerine göre ürün arama
     * @param volume Aranacak hacim değeri
     * @param limit Maksimum sonuç sayısı
     */
    searchByVolume(volume: number, limit: number = 10): Observable<any[]> {
      this.ensureApiUrl();
      let params = new HttpParams()
        .set('volume', volume.toString())
        .set('limit', limit.toString());

      return this.http.get<any>(`${this.apiUrl}`, { params })
        .pipe(
          map(response => {
            if (response && response.results) {
              return response.results;
            }
            return Array.isArray(response) ? response : [];
          })
        );
    }

    /**
     * Boyutlara göre ürün arama (genişlik, yükseklik, derinlik)
     */
    searchByDimensions(width?: number, height?: number, depth?: number, limit: number = 10): Observable<any[]> {
      this.ensureApiUrl()
      let params = new HttpParams().set('limit', limit.toString());

      if (width) {
        params = params.set('dimension.width', width.toString());
      }

      if (height) {
        params = params.set('dimension.height', height.toString());
      }

      if (depth) {
        params = params.set('dimension.depth', depth.toString());
      }

      return this.http.get<any>(`${this.apiUrl}`, { params })
        .pipe(
          map(response => {
            if (response && response.results) {
              return response.results;
            }
            return Array.isArray(response) ? response : [];
          })
        );
    }
}
