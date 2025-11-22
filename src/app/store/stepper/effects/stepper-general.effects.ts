import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { tap, withLatestFrom, map, filter } from 'rxjs/operators';
import { AppState, selectStepperState } from '../../index';
import { LocalStorageService } from '@features/stepper/services/local-storage.service';
import { ToastService } from '@core/services/toast.service';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperOrderActions } from '../actions/stepper-order.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { OrderActions } from '../actions/order.actions';

@Injectable()
export class StepperGeneralEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private localStorageService = inject(LocalStorageService);
  private toastService = inject(ToastService);

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
        // Order Actions
        OrderActions.set,
        StepperOrderActions.set,
        StepperOrderActions.uploadInvoiceProcessFileSuccess,
        StepperOrderActions.addOrderDetail,
        StepperOrderActions.updateOrderDetail,
        StepperOrderActions.deleteOrderDetail,
        StepperOrderActions.uploadFileToOrderSuccess,
        StepperOrderActions.createOrderDetailsSuccess,
        StepperOrderActions.saveSuccess,
        OrderActions.saveSuccess,
        StepperOrderActions.setTemplateFile,

        // Package Actions
        StepperPackageActions.calculatePackageDetailSuccess,
        StepperPackageActions.createPackageDetailsSuccess,
        StepperPackageActions.moveUiProductInSamePackage,
        StepperPackageActions.remainingProductMoveProduct,
        StepperPackageActions.moveProductToRemainingProducts,
        StepperPackageActions.moveUiProductInPackageToPackage,
        StepperPackageActions.moveRemainingProductToPackage,
        StepperPackageActions.movePalletToPackage,
        StepperPackageActions.splitProduct,
        StepperPackageActions.removeProductFromPackage,
        StepperPackageActions.removeAllPackage,
        StepperPackageActions.removePalletFromPackage,
        StepperPackageActions.removePackage,
        StepperPackageActions.addUiProductToRemainingProducts,
        StepperPackageActions.updateProductCountAndCreateOrUpdateOrderDetail,
        StepperPackageActions.movePartialRemainingProductToPackage,
        StepperPackageActions.movePartialProductBetweenPackages,
      ),
      map(() => StepperUiActions.stepperStepUpdated())
    )
  );
}
