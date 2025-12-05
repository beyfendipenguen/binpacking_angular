import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { tap, withLatestFrom, map, filter, catchError, switchMap } from 'rxjs/operators';
import { AppState, selectStepperState } from '../../index';
import { LocalStorageService } from '@features/stepper/services/local-storage.service';
import { ToastService } from '@core/services/toast.service';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperInvoiceUploadActions } from '../actions/stepper-invoice-upload.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { mapPackageReadDtoListToIUiPackageList } from '@app/features/mappers/package.mapper';
import { forkJoin, of } from 'rxjs';
import { OrderDetailService } from '@app/features/services/order-detail.service';
import { OrderService } from '@app/features/services/order.service';
import { RepositoryService } from '@app/features/stepper/services/repository.service';
import { PackageService } from '@app/features/services/package.service';

@Injectable()
export class StepperGeneralEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private localStorageService = inject(LocalStorageService);
  private toastService = inject(ToastService);
  private orderService = inject(OrderService);
  private orderDetailService = inject(OrderDetailService);
  private repositoryService = inject(RepositoryService);
  private packageService = inject(PackageService)


  // Edit Modu: Sipariş, detaylar ve paketleri paralel yükler
  enableEditMode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperUiActions.enableEditMode),
      switchMap((action) =>
        forkJoin({
          order: this.orderService.getById(action.orderId),
          orderDetails: this.orderDetailService.getByOrderId(action.orderId),
          packages: this.packageService.getAll({ order_id: action.orderId, limit: 100 }).pipe(
            map(response => response.results)
          ),
          pallets: this.repositoryService.getPalletsByOrder(action.orderId),
        }).pipe(
          switchMap(({ order, orderDetails, packages, pallets }) => [
            StepperInvoiceUploadActions.saveSuccess({ order }),
            StepperInvoiceUploadActions.upsertManySuccess({ orderDetails }),
            StepperPackageActions.upsertManySuccess({ packages }),
            StepperPackageActions.getPalletsSuccess({ pallets })
          ]),
          catchError((error) => of(StepperUiActions.setGlobalError({ error })))
        )
      )
    )
  );

  //Order name i edit modda rev1 2 artirmak icin
  reviseOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperUiActions.reviseOrder),
      switchMap((action) =>
        this.orderService.reviseOrder(action.orderId).pipe(
          map(() => StepperUiActions.reviseOrderSuccess()),
          catchError((error) => of(StepperUiActions.reviseOrderFailure()))
        )
      )
    )
  )

  // Global hataları kullanıcıya gösterir
  globalErrorLogging$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StepperUiActions.setGlobalError),
        tap(({ error }) => {
          this.toastService.error(
            error.message,
            error.stepIndex !== undefined
              ? `Step ${error.stepIndex + 1} Hatası`
              : 'Sistem Hatası'
          );
          console.error('[Stepper Error]', error.message);
        })
      ),
    { dispatch: false }
  );

  // Herhangi bir değişiklikte state'i LocalStorage'a yedekler
  autoSave$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StepperUiActions.stepperStepUpdated),
        withLatestFrom(this.store.select(selectStepperState)),
        tap(([_, stepperState]) => {
          this.localStorageService.saveStepperData(stepperState);
        })
      ),
    { dispatch: false }
  );

  // Sayfa yenilendiğinde veriyi geri yükler
  restoreLocalStorageData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperUiActions.restoreLocalStorageData),
      filter(() => this.localStorageService.hasExistingData()),
      map(() => {
        const data = this.localStorageService.getStepperData();
        return StepperUiActions.setStepperData({ data });
      })
    )
  );

  // Veri değiştiren action'ları dinleyip "updated" sinyali üretir (AutoSave'i tetikler)
  triggerStepperStepUpdated$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperUiActions.setStepCompleted,
        StepperUiActions.navigateToStep,

        // Invoice Upload Actions
        StepperInvoiceUploadActions.set,
        StepperInvoiceUploadActions.uploadInvoiceProcessFileSuccess,
        StepperInvoiceUploadActions.addOrderDetail,
        StepperInvoiceUploadActions.updateOrderDetail,
        StepperInvoiceUploadActions.deleteOrderDetail,
        StepperInvoiceUploadActions.upsertManySuccess,
        StepperInvoiceUploadActions.saveSuccess,
        StepperInvoiceUploadActions.getReportTemplateFile,

        // Package Actions
        StepperPackageActions.calculatePackageDetailSuccess,
        StepperPackageActions.createPackageDetailsSuccess,
        StepperPackageActions.movePackageDetailInSamePackage,
        StepperPackageActions.remainingProductMoveProduct,
        StepperPackageActions.movePackageDetailToRemainingProducts,
        StepperPackageActions.movePackageDetailInPackageToPackage,
        StepperPackageActions.moveRemainingProductToPackage,
        StepperPackageActions.movePalletToPackage,
        StepperPackageActions.splitPackageDetail,
        StepperPackageActions.removePackageDetailFromPackage,
        StepperPackageActions.removeAllPackage,
        StepperPackageActions.removePalletFromPackage,
        StepperPackageActions.removePackage,
        StepperPackageActions.addPackageDetailToRemainingProducts,
        StepperPackageActions.upsertPackageDetailCount,
        StepperPackageActions.movePartialRemainingProductToPackage,
        StepperPackageActions.movePartialPackageDetailBetweenPackages,
      ),
      map(() => StepperUiActions.stepperStepUpdated())
    )
  );
}
