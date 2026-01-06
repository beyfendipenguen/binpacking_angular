import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, of, tap, map } from 'rxjs';
import { INVOICE_UPLOAD_CONSTANTS } from '../constants/invoice-upload.constants';
import { Store } from '@ngrx/store';
import { ToastService } from '@app/core/services/toast.service';
import { Truck } from '@app/features/interfaces/truck.interface';
import { LocalStorageService } from '@app/features/stepper/services/local-storage.service';
import { RepositoryService } from '@app/features/stepper/services/repository.service';
import { AppState, selectUser } from '@app/store';
import { ReferenceData } from '../models/invoice-upload-interfaces';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class InvoiceDataLoaderService {
  private readonly repositoryService = inject(RepositoryService);
  private readonly toastService = inject(ToastService);
  private readonly store = inject(Store<AppState>);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly translateService = inject(TranslateService);
  user$ = this.store.select(selectUser);
  private readonly CACHE_KEY = 'invoice_reference_data';

  constructor() {
    this.loadCacheFromStorage();
  }

  private cachedData: ReferenceData = {
    targetCompanies: [],
    trucks: []
  };

  private loadCacheFromStorage(): void {
    const stored = this.localStorageService.getItem(this.CACHE_KEY);
    if (stored) {
      try {
        this.cachedData = JSON.parse(stored);
      } catch (error) {
        this.clearCache();
      }
    }
  }

  private saveCacheToStorage(): void {
    this.localStorageService.setItem(this.CACHE_KEY, JSON.stringify(this.cachedData));
  }

  loadTargetCompanies(): Observable<any[]> {
    if (this.cachedData.targetCompanies.length > 0) {
      return of(this.cachedData.targetCompanies);
    }

    return this.user$.pipe(
      switchMap((response) => {
        if (response && response.company && response.company.id) {
          return this.repositoryService.companyRelations(response.company.id).pipe(
            tap((companies) => {
              this.cachedData.targetCompanies = companies;
              this.saveCacheToStorage();
            })
          );
        } else {
          this.toastService.error(this.translateService.instant(INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.COMPANY_LOADING));
          return of([]);
        }
      })
    );
  }

  loadTrucks(): Observable<Truck[]> {
    if (this.cachedData.trucks.length > 0) {
      return of(this.cachedData.trucks);
    }

    return this.repositoryService.getTrucks().pipe(
      tap((response) => {
        this.cachedData.trucks = response.results;
        this.saveCacheToStorage();
      }),
      map((response) => response.results)
    );
  }

  loadAllReferenceData(): Observable<ReferenceData> {
    if (this.cachedData.trucks.length > 0 && this.cachedData.targetCompanies.length > 0) {
      return of(this.cachedData);
    }

    return new Observable(observer => {
      const referenceData: ReferenceData = {
        targetCompanies: [],
        trucks: []
      };

      let completedRequests = 0;
      const totalRequests = 2;

      const checkCompletion = () => {
        completedRequests++;
        if (completedRequests === totalRequests) {
          this.cachedData = referenceData;
          this.saveCacheToStorage();
          observer.next(referenceData);
          observer.complete();
        }
      };

      // Load target companies
      this.loadTargetCompanies().subscribe({
        next: (companies) => {
          referenceData.targetCompanies = companies;
          checkCompletion();
        },
        error: (error) => {
          if(error.status !== 403)
          this.toastService.error(this.translateService.instant(INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.COMPANY_LOADING));
          checkCompletion();
        }
      });

      // Load trucks
      this.loadTrucks().subscribe({
        next: (trucks) => {
          referenceData.trucks = trucks;
          checkCompletion();
        },
        error: (error) => {
          if(error.status !== 403)
          this.toastService.error(this.translateService.instant(INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.TRUCK_LOADING));
          checkCompletion();
        }
      });
    });
  }

  clearCache(): void {
    this.cachedData = {
      targetCompanies: [],
      trucks: []
    };
    this.localStorageService.removeItem(this.CACHE_KEY);
  }

  getCachedData(): ReferenceData {
    return { ...this.cachedData };
  }
}
