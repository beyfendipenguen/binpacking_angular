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
  private readonly toastService = inject(ToastService);
  private readonly store = inject(Store<AppState>);
  private readonly translateService = inject(TranslateService);
  user$ = this.store.select(selectUser);
  public referenceData$: BehaviorSubject<ReferenceData> = new BehaviorSubject<ReferenceData>({
    targetCompanies: [],
    trucks: []
  })
  public refreshCompanyRelationSettings$ = new Subject();

  constructor() {
    this.loadAllReferenceData();
  }

  loadTargetCompanies(): Observable<any[]> {
    return this.user$.pipe(
      switchMap((response) => {
        if (response && response.company && response.company.id) {
          return this.repositoryService.companyRelations(response.company.id).pipe(
          );
        } else {
          this.toastService.error(this.translateService.instant(INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.COMPANY_LOADING));
          return of([]);
        }
      })
    );
  }

  loadTrucks(): Observable<Truck[]> {
    return this.repositoryService.getTrucks().pipe(
      map((response) => response.results)
    );
  }

  loadAllReferenceData(): void {

    const referenceData: ReferenceData = {
      targetCompanies: [],
      trucks: []
    };

    let completedRequests = 0;
    const totalRequests = 2;

    const checkCompletion = () => {
      completedRequests++;
      if (completedRequests === totalRequests) {
        this.referenceData$.next(referenceData);
      }
    };

    // Load target companies
    this.loadTargetCompanies().subscribe({
      next: (companies) => {
        referenceData.targetCompanies = companies;
        checkCompletion();
      },
      error: (error) => {
        if (error.status !== 403)
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
        if (error.status !== 403)
          this.toastService.error(this.translateService.instant(INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.TRUCK_LOADING));
        checkCompletion();
      }
    });
  }
}
