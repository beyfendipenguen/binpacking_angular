import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { tap, withLatestFrom, map, filter, catchError, switchMap } from 'rxjs/operators';
import { AppState, selectStepperState, StepperResultActions } from '../../index';
import { LocalStorageService } from '@features/stepper/services/local-storage.service';
import { ToastService } from '@core/services/toast.service';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperInvoiceUploadActions } from '../actions/stepper-invoice-upload.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { forkJoin, of } from 'rxjs';
import { OrderDetailService } from '@app/features/services/order-detail.service';
import { OrderService } from '@app/features/services/order.service';
import { RepositoryService } from '@app/features/stepper/services/repository.service';
import { PackageService } from '@app/features/services/package.service';
import { OrderResultService } from '@app/features/services/order-result.service';
import { FileService } from '@app/core/services/file.service';
import { ReportFile } from '@app/features/stepper/components/result-step/result-step.service';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

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
  private orderResultService = inject(OrderResultService)
  private fileService = inject(FileService)


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
          orderResult: this.orderResultService.getByOrderId(action.orderId).pipe(
            catchError(() => of([])) // Hata olursa boş array döndür
          ),
          files: this.fileService.getAll({ order_id: action.orderId, limit: 30, offset: 0 }).pipe(
            map((response: any) => response.results.map((file: any) => ({
              id: file.id,
              name: file.name,
              type: file.type || file.file_type,
              file: file.file,
            }))),
            catchError(() => of([]))
          ),
        }).pipe(
          switchMap(({ order, orderDetails, packages, pallets, orderResult, files }) => {
            const filteredFiles = files.filter((file: ReportFile) =>
              file.name.includes(order.name)
            );

            // Base actions - her zaman dispatch edilecek
            const baseActions = [
              StepperInvoiceUploadActions.saveSuccess({ order }),
              StepperInvoiceUploadActions.upsertManySuccess({ orderDetails }),
              StepperPackageActions.upsertManySuccess({ packages }),
              StepperPackageActions.getPalletsSuccess({ pallets }),
            ];

            // OrderResult varsa ekstra action'ları ekle
            if (orderResult && orderResult.length > 0 && orderResult[0]) {
              const cleanedResult = orderResult[0].result as PackagePosition[] || [];
              const orderResultId = orderResult[0].id;

              return [
                ...baseActions,
                StepperResultActions.setOrderResultId({ orderResultId }),
                StepperResultActions.loadOrderResultSuccess({
                  orderResult: cleanedResult,
                  reportFiles: filteredFiles
                })
              ];
            }

            // OrderResult yoksa sadece base action'ları döndür
            return baseActions;
          }),
          catchError((error) => {
            return of(StepperUiActions.setGlobalError({ error }));
          })
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
              ? `Step ${error.stepIndex + 1} Error`
              : 'Error'
          );
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
        StepperPackageActions.reducePackageDetailCount,
        StepperPackageActions.upsertPackageDetailCount,
        StepperPackageActions.movePartialRemainingProductToPackage,
        StepperPackageActions.movePartialPackageDetailBetweenPackages,
        StepperPackageActions.addPalletToAvailable,

        //Result Actions
        StepperResultActions.loadOrderResultSuccess,
        StepperResultActions.setOrderResultId,
        StepperResultActions.setOrderResult
      ),
      map(() => StepperUiActions.stepperStepUpdated())
    )
  );
}
