import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, of, tap, map, BehaviorSubject, Subject } from 'rxjs';
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
  private readonly store = inject(Store<AppState>);
  user$ = this.store.select(selectUser);

  constructor() {
  }

  searchCompanyRelations(searchTerm: string = '', limit: number = 5): Observable<any[]> {
    return this.user$.pipe(
      switchMap((response) => {
        if (response?.company?.id) {
          // Query params oluştur
          const params: any = {
            active_only: 'true',
            limit: limit.toString()
          };

          // Search terimi varsa ekle
          if (searchTerm.trim()) {
            params.search = searchTerm.trim();
          }

          return this.repositoryService.companyRelations(response.company.id, params);
        } else {
          return of([]);
        }
      })
    );
  }


  loadTrucksLimited(limit: number = 50): Observable<Truck[]> {
    return this.repositoryService.getTrucks({ limit: limit.toString() }).pipe(
      map((response) => response.results)
    );
  }
}
