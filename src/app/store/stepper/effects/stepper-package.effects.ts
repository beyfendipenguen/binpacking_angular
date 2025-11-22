import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, filter, concatMap, take, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { OrderDetailActions } from '../actions/order-detail.actions';
import {
  AppState,
  selectVerticalSort,
  selectCompanyRelationId,
  selectPackageChanges,
  selectIsPackagesDirty
} from '../../index';

import { RepositoryService } from '@features/stepper/services/repository.service';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { mapPackageDetailToPackage } from '@features/mappers/package-detail.mapper';
import { StepperOrderActions } from '../actions/stepper-order.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { PackageActions } from '../actions/package-detail.actions';

@Injectable()
export class StepperPackageEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);

  // Fatura yüklendiğinde paletleri getir
  triggerGetPallets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.uploadInvoiceProcessFileSuccess),
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
          map(response => ({
            uiPackages: mapPackageDetailToPackage(response.package_details),
          })),
          map((response) => StepperPackageActions.calculatePackageDetailSuccess({ packages: response.uiPackages }))
        )
      )
    )
  );

  // Paket Detaylarını Kaydetme
  packageDetailsUpsertMany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PackageActions.upsertMany),
      withLatestFrom(
        this.store.select(selectPackageChanges),
        this.store.select(selectIsPackagesDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([_, changes]) =>
        this.repositoryService.bulkUpdatePackageDetails(changes).pipe(
          map((result) => PackageActions.upsertManySuccess({ packageDetails: result.package_details })),
          catchError((error) => of(OrderDetailActions.upsertManyFailure({ error: error.message })))
        )
      )
    )
  );

  // Palet Kontrol Adımını Tamamla (Sıralı Kayıt: Paketler -> Detaylar -> Step Complete)
  palletControlSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.palletControlSubmit),
      switchMap(() =>
        of(PackageActions.upsertMany()).pipe(
          concatMap(() =>
            this.actions$.pipe(
              ofType(PackageActions.upsertManySuccess),
              take(1),
              map(() => OrderDetailActions.upsertMany())
            )
          ),
          concatMap(() =>
            this.actions$.pipe(
              ofType(OrderDetailActions.upsertManySuccess),
              take(1),
              map(() => StepperUiActions.setStepCompleted({ stepIndex: 2 }))
            )
          )
        )
      )
    )
  );

  // Paket/Ürün değişikliklerini izle ve hesapla
  packageChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperPackageActions.movePalletToPackage,
        StepperPackageActions.removePalletFromPackage,
        StepperPackageActions.moveUiProductInPackageToPackage,
        StepperPackageActions.movePartialProductBetweenPackages,
        StepperPackageActions.moveUiProductInSamePackage,
        StepperPackageActions.moveRemainingProductToPackage,
        StepperPackageActions.movePartialRemainingProductToPackage,
        StepperPackageActions.moveProductToRemainingProducts,
        StepperPackageActions.remainingProductMoveProduct,
        StepperPackageActions.removePackage,
        StepperPackageActions.removeAllPackage,
        StepperPackageActions.removeProductFromPackage,
        StepperPackageActions.splitProduct,
        StepperPackageActions.addUiProductToRemainingProducts,
        StepperPackageActions.deleteRemainingProduct,
        StepperPackageActions.setVerticalSortInPackage,
        StepperPackageActions.updateProductCountAndCreateOrUpdateOrderDetail,
      ),
      tap(() => console.log('[packageChanges$] Değişiklik tespit edildi, hesaplanıyor...')),
      map(() => StepperPackageActions.calculatePackageChanges()),
      catchError((error) => {
        console.error('[packageChanges$] Hata:', error);
        return of(StepperUiActions.setGlobalError({
          error: { message: 'Package changes calculation error', stepIndex: 2 }
        }));
      })
    )
  );

  // Sipariş Detayı Değişikliklerini Hesapla
  orderDetailChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperPackageActions.deleteRemainingProduct,
        StepperPackageActions.addUiProductToRemainingProducts,
        StepperPackageActions.updateProductCountAndCreateOrUpdateOrderDetail,
        StepperOrderActions.deleteOrderDetail,
      ),
      map(() => StepperOrderActions.calculateOrderDetailChanges()),
      catchError((error) => of(StepperUiActions.setGlobalError({ error: error.message })))
    )
  );
}
