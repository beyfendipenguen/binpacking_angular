import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  map,
  tap,
  switchMap,
  catchError,
  withLatestFrom,
  mergeMap,
  filter,
  concatMap,
} from 'rxjs/operators';
import { EMPTY, forkJoin, of, timer } from 'rxjs';
import * as StepperActions from './stepper.actions';
import {
  AppState,
  selectCompletedStep,
  selectOrder,
  selectStep1Changes,
  selectStep1IsDirty,
  selectStep2IsDirty,
  selectOrderResult,
  selectStepperState,
  selectUiPackages,
  selectVerticalSort,
} from '../index';
import { ToastService } from '../../services/toast.service';
import { OrderService } from '../../admin/components/services/order.service';
import { OrderDetailService } from '../../admin/components/services/order-detail.service';
import { FileUploadManager } from '../../admin/components/stepper/components/invoice-upload/managers/file-upload.manager';
import { LocalStorageService } from '../../admin/components/stepper/services/local-storage.service';
import { RepositoryService } from '../../admin/components/stepper/services/repository.service';
import { UIStateManager } from '../../admin/components/stepper/components/invoice-upload/managers/ui-state.manager';

@Injectable()
export class StepperEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private localStorageService = inject(LocalStorageService);
  private toastService = inject(ToastService);
  private repositoryService = inject(RepositoryService);
  private fileUploadManager = inject(FileUploadManager);
  private orderService = inject(OrderService);
  private orderDetailService = inject(OrderDetailService);

  // Private helper method
  // Global Error Effects
  globalErrorLogging$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StepperActions.setGlobalError),
        tap(({ error }) => {
          // Error toast göster
          this.toastService.error(
            error.message,
            error.stepIndex !== undefined
              ? `Step ${error.stepIndex + 1} Hatası`
              : 'Sistem Hatası'
          );
        })
      ),
    { dispatch: false }
  );

  enableEditMode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.enableEditMode),
      mergeMap((action) => {
        return forkJoin({
          order: this.orderService.getById(action.orderId),
          orderDetails: this.orderDetailService.getByOrderId(action.orderId),
          packagesAndRemainingProducts:
            this.repositoryService.getPackageDetails(action.orderId),
        }).pipe(
          mergeMap(({ order, orderDetails, packagesAndRemainingProducts }) => {
            return of(
              StepperActions.setStepperData({ data: { order: order, completedStep: 2 } }),
              StepperActions.setOrderDetails({ orderDetails: orderDetails }),
              StepperActions.setUiPackages({
                packages: packagesAndRemainingProducts.packages,
              }),
              StepperActions.setRemainingProducts({
                remainingProducts:
                  packagesAndRemainingProducts.remainingProducts,
              })
            );
          })
        );
      })
    )
  );

  autoSave$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StepperActions.stepperStepUpdated),
        withLatestFrom(this.store.select(selectStepperState)),
        tap(([action, stepperState]) => {
          this.localStorageService.saveStepperData(stepperState);
        })
      ),
    { dispatch: false }
  );

  restoreLocalStorageData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.restoreLocalStorageData),
      filter(() => this.localStorageService.hasExistingData()),
      map(() => {
        const data = this.localStorageService.getStepperData();
        return StepperActions.setStepperData({ data: data });
      })
    )
  );

  /// burada update or create actionindan gelen context degerini update or create order success actionina gecmeye calisiyorum hata var coz
  updateOrCreateOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrCreateOrder),
      withLatestFrom(this.store.select(selectOrder)),
      switchMap(([action, order]) => {
        return this.orderService.updateOrCreate(order).pipe(
          map((result) =>
            StepperActions.updateOrCreateOrderSuccess({
              order: result.order,
              context: action.context,
            })
          ),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        );
      })
    )
  );

  updateOrderDetailChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrderDetailsChanges),
      withLatestFrom(
        this.store.select(selectStep1Changes),
        this.store.select(selectStep1IsDirty)
      ),
      filter(([_, changes, isDirty]) => isDirty),
      switchMap(([action, changes]) =>
        this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          map((result) =>
            StepperActions.updateOrderDetailsChangesSuccess({
              orderDetails: result.order_details,
              context: action.context,
            })
          ),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        )
      )
    )
  );

  updateOrderDetailsSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrderDetailsChangesSuccess),
      switchMap((action) => {
        if (action.context === 'calculatePackageDetails')
          return of(StepperActions.calculatePackageDetail());
        return EMPTY;
      })
    )
  );

  createOrderDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.createOrderDetails),
      withLatestFrom(this.store.select(selectStep1Changes)),
      switchMap(([action, changes]) =>
        this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          map((result) =>
            StepperActions.createOrderDetailsSuccess({
              orderDetails: result.order_details,
              context: action.context,
            })
          ),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        )
      )
    )
  );

  invoiceUploadSubmitFlow$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.invoiceUploadSubmitFlow),
      switchMap((action) =>
        of(
          StepperActions.updateOrCreateOrder({
            context: 'invoiceUploadSubmitFlow',
          })
        )
      )
    )
  );

  createOrderDetailsInvoiceUploadSubmitFlow$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.createOrderDetailsSuccess),
      switchMap((action) => {
        if (action.context === "invoiceUploadSubmitFlow") {
          return of(
            StepperActions.uploadFileToOrder({
              context: action.context
            }))
        }
        else {
          return EMPTY
        }
      }))
  });

  getPalletsFlow$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.updateOrCreateOrderSuccess),
      filter((action) => ['invoiceUploadSubmitFlow', 'companyRelationUpdated'].includes(action.context)),
      map(() => StepperActions.getPallets())
    )
  })

  getPallets$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.getPallets),
      switchMap(() =>
        this.repositoryService.getPalletsByOrder().pipe(
          map((response) => StepperActions.getPalletsSuccess({ pallets: response })),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        )
      )
    )
  });


  updateOrCreateOrderInvoiceUploadSubmitFlow$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.updateOrCreateOrderSuccess),
      switchMap((action) => {
        // Context kontrolü
        if (action.context === 'invoiceUploadSubmitFlow') {
          return of(
            StepperActions.createOrderDetails({
              context: 'invoiceUploadSubmitFlow',
            })
          );
        }
        return EMPTY; // Context uygun değilse hiçbir şey yapma
      }),
      catchError((error) => {
        return of(
          StepperActions.setStepperError({
            error: error.message || 'Unknown error',
          })
        );
      })
    );
  });

  calculatePackageDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.calculatePackageDetail),
      withLatestFrom(this.store.select(selectVerticalSort)),
      switchMap(([action, verticalSort]) =>
        this.repositoryService.calculatePackageDetail(verticalSort).pipe(
          map((response) =>
            StepperActions.calculatePackageDetailSuccess({
              packages: response.packageDetails,
              remainingOrderDetails: response.remainingOrderDetails,
            })
          )
        )
      )
    )
  );

  invoiceUploadCompleted$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperActions.createOrderDetailsSuccess
      ),
      withLatestFrom(this.store.select(selectCompletedStep)),
      filter(([orderDetails, stepIndex]) => stepIndex <= 1),
      map(() => StepperActions.setStepCompleted({ stepIndex: 1 }))
    )
  );

  uploadInvoiceFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.uploadFileToOrder),
      withLatestFrom(this.store.select(selectOrder)),
      switchMap(([action, order]) =>
        this.fileUploadManager.uploadFileToOrder(order.id).pipe(
          map(() => StepperActions.invoiceUploadSubmitFlowSuccess()),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          )
        )
      )
    )
  );

  triggerAutoSaveForUiPackageChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperActions.moveUiProductInSamePackage,
        StepperActions.remainingProductMoveProduct,
        StepperActions.moveProductToRemainingProducts,
        StepperActions.moveUiProductInPackageToPackage,
        StepperActions.moveRemainingProductToPackage,
        StepperActions.movePalletToPackage,
        StepperActions.splitProduct,
        StepperActions.removeProductFromPackage,
        StepperActions.removeAllPackage,
        StepperActions.removePalletFromPackage,
        StepperActions.removePackage,
        StepperActions.addUiProductToRemainingProducts,
        StepperActions.updateProductCountAndCreateOrUpdateOrderDetail,
        StepperActions.movePartialRemainingProductToPackage,
        StepperActions.movePartialProductBetweenPackages
      ),
      map(() => StepperActions.stepperStepUpdated())
    )
  );

  triggerStepperStepUploaded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperActions.setOrder,
        StepperActions.uploadInvoiceProcessFileSuccess,
        StepperActions.addOrderDetail,
        StepperActions.updateOrderDetail,
        StepperActions.deleteOrderDetail,
        StepperActions.uploadFileToOrderSuccess,
        StepperActions.createOrderDetailsSuccess,
        StepperActions.updateOrCreateOrderSuccess,
        StepperActions.calculatePackageDetailSuccess,
        StepperActions.setUiPackages,
        StepperActions.palletControlSubmitSuccess,
        StepperActions.setTemplateFile
      ),
      map(() => StepperActions.stepperStepUpdated())
    )
  );

  uploadInvoiceProcessFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.uploadInvoiceProcessFile),
      switchMap(() =>
        this.fileUploadManager.uploadFile().pipe(
          mergeMap((response) => {
            return of(
              StepperActions.initializeStep1StateFromUpload({
                order: response.order,
                orderDetails: response.orderDetail,
                hasFile: true,
                fileName: 'File Upload Result',
              }),
              StepperActions.setStepLoading({
                stepIndex: 0,
                loading: false,
                operation: 'file upload completed',
              }),
              StepperActions.uploadInvoiceProcessFileSuccess()
            );
          }),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          )
        )
      )
    )
  );

  palletControlSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.palletControlSubmit),
      withLatestFrom(
        this.store.select(selectUiPackages),
        this.store.select(selectStep2IsDirty)
      ),
      filter(([action, uiPackages, isDirty]) => isDirty),
      concatMap(([action, uiPackages]) => {
        return this.repositoryService.bulkCreatePackageDetail(uiPackages).pipe(
          map((response) =>
            StepperActions.palletControlSubmitSuccess({
              packageDetails: response.package_details,
            })
          ),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          )
        );
      })
    )
  );

  palletControlSubmitSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.palletControlSubmitSuccess),
      withLatestFrom(this.store.select(selectStep1IsDirty)),
      filter(([_, isDirty]) => isDirty),
      map(() => StepperActions.calculateOrderDetailChanges())
    )
  );

  updateOrderDetailsChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.calculateOrderDetailChanges),
      withLatestFrom(this.store.select(selectStep1IsDirty)),
      filter(([_, isDirty]) => isDirty),
      map(() => StepperActions.updateOrderDetailsChanges({}))
    )
  );

  // pallet 2 de yapilan tum ekleme silme ve guncelleme islemleri icin
  // tetiklenen actionlari dinleyip onlarin success durumlarda veya direk ilgili
  // actionlarin bittigi durumda step1 changes hesaplayip guncelleme islemini yapmaliyim
  // kullanici step2 de pallet control submit islemini devreye soktugu zaman
  // step 1 changes durumuna bakip gerekiyorsa backende gitmeliyim
  // eger gerekmiyorsa api istegi atamadan islemi bitirmeliyim

  orderDetailChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperActions.deleteRemainingProduct,
        StepperActions.addUiProductToRemainingProducts,
        StepperActions.updateProductCountAndCreateOrUpdateOrderDetail
      ),
      map(() => StepperActions.calculateOrderDetailChanges()),
      catchError((error) =>
        of(StepperActions.setGlobalError({ error: error.message }))
      )
    )
  );


  updateOrderResult$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.updateOrderResult),
      withLatestFrom(this.store.select(selectOrderResult)),
      switchMap(([action, orderResult]) => {
        return this.repositoryService.partialUpdateOrderResult(orderResult).pipe(
          map((response) =>
            StepperActions.createReportFile()
          ))
      })
    );
  })

  createReportFile$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.createReportFile),
      switchMap((action) => {
        return this.repositoryService.createReport().pipe(
          map((response) => StepperActions.createReportFileSuccess({ reportFiles: response.files }))

        )
      }
      )
    )
  })

  cleanUpInvalidPakcagesFromOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.cleanUpInvalidPackagesFromOrder),
      map(() => StepperActions.palletControlSubmit()),
      catchError((error) =>
        of(StepperActions.setGlobalError({ error: error.message }))
      )
    )
  );

}
