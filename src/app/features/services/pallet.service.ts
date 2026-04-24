import { HttpClient, HttpContext, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { catchError, map, Observable, of, switchMap, take } from "rxjs";
import { BulkUploadResponse, Pallet } from "../interfaces/pallet.interface";
import { SKIP_LOADING } from "@app/shared/loading/skip-loading.token";
import { AppState, selectUiPallets } from "@app/store";
import { Store } from "@ngrx/store";

@Injectable({
  providedIn: 'root',
})
export class PalletService extends GenericCrudService<Pallet> {
  private readonly store = inject(Store<AppState>);
  constructor(http: HttpClient) {
    super(http, 'logistics/pallets');
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
 * Yerel pallet listesi üzerinde arama yapar.
 * Query tek sayı ise OR (herhangi bir boyut), iki sayı ise AND (tam eşleşme) mantığı uygular.
 */
  public filterLocalPallets(query: string, pallets: any[]): any[] {
    if (!pallets || pallets.length === 0) {
      return [];
    }

    const trimmedQuery = query.toLowerCase().trim();
    const hasX = /\s*x\s*/i.test(trimmedQuery);
    const hasSpace = trimmedQuery.includes(' ');

    let searchDepth: number | null = null;
    let searchWidth: number | null = null;
    let isExplicitPair = false;

    if (hasX || hasSpace) {
      const parts = trimmedQuery.split(/\s*x\s*|\s+/i)
        .map(p => p.trim())
        .filter(p => p.length > 0 && !isNaN(Number(p)))
        .map(p => Number(p));

      if (parts.length === 2) {
        searchDepth = parts[0];
        searchWidth = parts[1];
        isExplicitPair = true;
      } else if (parts.length === 1) {
        searchDepth = searchWidth = parts[0];
      }
    } else if (!isNaN(Number(trimmedQuery))) {
      searchDepth = searchWidth = Number(trimmedQuery);
    }

    const matchedPallets = pallets.filter((pallet) => {
      if (pallet.name && pallet.name.toLowerCase().includes(trimmedQuery)) {
        return true;
      }

      if (pallet.dimension && searchDepth !== null && searchWidth !== null) {
        const palletDepth = Math.trunc(pallet.dimension.depth);
        const palletWidth = Math.trunc(pallet.dimension.width);

        if (isExplicitPair) {
          return palletDepth === searchDepth && palletWidth === searchWidth;
        } else {
          return palletDepth === searchDepth || palletWidth === searchWidth;
        }
      }

      return false;
    });

    return matchedPallets.filter(
      (pallet, index, self) => index === self.findIndex((p) => p.id === pallet.id)
    );
  }

  /**
   * Palet arama metodu - Backend'den gelen sonuçları sınırlandırır
   * @param query Arama sorgusu
   * @param limit Maksimum sonuç sayısı (varsayılan 10)
   */
  searchPalletsWithParsedQuery(
    query: string,
    limit: number = 10
  ): Observable<Pallet[]> {
    this.ensureApiUrl();

    if (!query || query.trim().length < 1) {
      return of([]);
    }

    return this.store.select(selectUiPallets).pipe(
      take(1),
      switchMap((storePallets) => {
        const localResults = this.filterLocalPallets(query, storePallets);
        if (localResults.length > 0) {
          return of(localResults);
        }
        const parsedParams = this.parsePalletQuery(query);

        if (Object.keys(parsedParams).length === 0) {
          return of(localResults);
        }

        let params = new HttpParams().set('limit', limit.toString());
        Object.keys(parsedParams).forEach((key) => {
          if (parsedParams[key]) params = params.set(key, parsedParams[key]);
        });

        const context = new HttpContext().set(SKIP_LOADING, true);

        return this.http.get<any>(this.apiUrl, { params, context }).pipe(
          map((response) => {
            const backendResults = response?.results || [];
            // Local + backend'i birleştir, id'ye göre dedupe
            const merged = [...localResults, ...backendResults];
            return merged.filter(
              (p, i, self) => i === self.findIndex((x) => x.id === p.id)
            );
          }),
          catchError(() => of(localResults))  // Hata olsa bile local sonuçları göster
        );
      })
    );
  }

  private parsePalletQuery(query: string): any {
    const trimmedQuery = query.trim();
    const params: any = {};

    const hasX = /\s*x\s*/i.test(trimmedQuery);
    const hasSpace = trimmedQuery.includes(' ');

    let parts: string[];
    if (hasX) {
      parts = trimmedQuery.split(/\s*x\s*/i).filter((p) => p.length > 0);
    } else if (hasSpace) {
      parts = trimmedQuery.split(/\s+/).filter((p) => p.length > 0);
    } else {
      parts = [trimmedQuery];
    }

    const numericParts = parts.filter((p) => !isNaN(Number(p)));

    if (numericParts.length === 0) {
      return params;
    }

    if (numericParts.length === 1) {
      params['dimension_search'] = numericParts[0];
    } else if (numericParts.length === 2) {
      params['dimension.depth'] = numericParts[0];
      params['dimension.width'] = numericParts[1];
    }

    return params;
  }


}
