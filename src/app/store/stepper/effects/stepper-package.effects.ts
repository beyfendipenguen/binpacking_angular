import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, filter, concatMap, take, tap, mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';

import { StepperInvoiceUploadActions } from '../actions/stepper-invoice-upload.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { StepperUiActions } from '../actions/stepper-ui.actions';

import {
  AppState,
  selectVerticalSort,
  selectCompanyRelationId,
  selectPackageChanges,
  selectIsPackagesDirty
} from '../../index';

import { RepositoryService } from '@features/stepper/services/repository.service';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class StepperPackageEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);
  private translate = inject(TranslateService);

  orderDetailChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperPackageActions.deleteRemainingProducts,
        StepperPackageActions.addPackageDetailToRemainingProducts,
        StepperPackageActions.upsertPackageDetailCount,
      ),
      map(() => StepperPackageActions.calculateOrderDetailChanges()),
      catchError((error) =>
        of(StepperUiActions.setGlobalError({ error: { message: error.message } }))
      )
    )
  );

  // Fatura yüklendiğinde paletleri getir
  triggerGetPallets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.uploadInvoiceProcessFileSuccess),
      map(() => StepperPackageActions.getPallets())
    )
  );

  // Paletleri Servisten Çek
  getPallets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.getPallets),
      withLatestFrom(this.store.select(selectCompanyRelationId)),
      filter(([_, companyRelationId]) => !!companyRelationId),
      switchMap(() =>
        this.repositoryService.getPalletsByCompanyRelation().pipe(
          map(results => results.map(pallet => new UiPallet(pallet))),
          map((pallets) => StepperPackageActions.getPalletsSuccess({ pallets })),
          catchError((error) => of(StepperUiActions.setStepperError({ error: error.message })))
        )
      )
    )
  );

  // Paketleme Hesaplaması (Algoritma Çalıştırma)
  calculatePackageDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.calculatePackageDetail),
      withLatestFrom(this.store.select(selectVerticalSort)),
      switchMap(([_, verticalSort]) =>
        this.repositoryService.calculatePackageDetails(verticalSort).pipe(
          map((response) => StepperPackageActions.calculatePackageDetailSuccess({ packages: response.packages })),
          catchError((error) =>
            of(StepperUiActions.setGlobalError({
              error: { message: error.message, stepIndex: 2 }
            }))
          )
        )
      )
    )
  );

  calculatePackageDetailSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.calculatePackageDetailSuccess),
      map(() => StepperUiActions.setStepCompleted({ stepIndex: 2 }))
  ))

  // Paket Detaylarını Kaydetme
  packageDetailsUpsertMany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.upsertMany),
      withLatestFrom(
        this.store.select(selectPackageChanges),
        this.store.select(selectIsPackagesDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([_, changes]) =>
        this.repositoryService.bulkUpdatePackageDetails(changes).pipe(
          map((result) => StepperPackageActions.upsertManySuccess({ packages: result.packages })),
          catchError((error) => of(StepperPackageActions.upsertManyFailure()))
        )
      )
    )
  );

  // Palet Kontrol Adımını Tamamla (Sıralı Kayıt: Paketler -> Detaylar -> Step Complete)
  palletControlSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.palletControlSubmit),
      mergeMap(() =>
        [
          StepperPackageActions.upsertMany(),
          StepperInvoiceUploadActions.upsertMany()
        ]
      ),
    )
  );

  // Paket/Ürün değişikliklerini izle ve hesapla
  packageChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        // Drag-Drop: Pallet İşlemleri
        StepperPackageActions.movePalletToPackage,
        StepperPackageActions.removePalletFromPackage,

        // Drag-Drop: Product İşlemleri (Paketler Arası)
        StepperPackageActions.movePackageDetailInPackageToPackage,
        StepperPackageActions.movePartialPackageDetailBetweenPackages,

        // Drag-Drop: Product İşlemleri (Paket İçi)
        StepperPackageActions.movePackageDetailInSamePackage,

        // Drag-Drop: Remaining Products İşlemleri
        StepperPackageActions.moveRemainingProductToPackage,
        StepperPackageActions.movePartialRemainingProductToPackage,
        StepperPackageActions.movePackageDetailToRemainingProducts,
        StepperPackageActions.remainingProductMoveProduct,

        // Package İşlemleri
        StepperPackageActions.removePackage,
        StepperPackageActions.removeAllPackage,
        StepperPackageActions.removePackageDetailFromPackage,

        // Product İşlemleri
        StepperPackageActions.splitPackageDetail,
        StepperPackageActions.addPackageDetailToRemainingProducts,
        StepperPackageActions.deleteRemainingProducts,

        // Alignment Değişiklikleri
        StepperPackageActions.setVerticalSortInPackage,

        // Product Count Güncellemeleri
        StepperPackageActions.upsertPackageDetailCount,
      ),
      map(() => StepperPackageActions.calculatePackageChanges()),
      catchError((error) => {
        return of(StepperUiActions.setGlobalError({
          error: { message: this.translate.instant('STEPPER.PACKAGING_ERROR'), stepIndex: 2 }
        }));
      })
    )
  );
}
