
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  map,
  tap,
  debounceTime,
  switchMap,
  catchError,
  withLatestFrom,
  mergeMap,
  filter,
} from 'rxjs/operators';
import { EMPTY, forkJoin, of, timer } from 'rxjs';
import * as StepperActions from './stepper.actions';
import {
  AppState,
  selectOrder,
  selectOrderId,
  selectStep1Changes,
  selectStepperState,
  selectUiPackages,
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
  private uiStateManager = inject(UIStateManager);
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
          packagesAndRemainingProducts: this.repositoryService.getPackageDetails(action.orderId),
        }).pipe(
          mergeMap(({ order, orderDetails, packagesAndRemainingProducts }) => {
            return of(
              StepperActions.setOrder({ order: order }),
              StepperActions.setOrderDetails({ orderDetails: orderDetails }),
              StepperActions.setUiPackages({ packages: packagesAndRemainingProducts.packages }),
              StepperActions.setRemainingProducts({
                remainingProducts: packagesAndRemainingProducts.remainingProducts
              }),
            );
          })
        );
      }),
    )
  );

  autoSave$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.stepperStepUpdated),
      withLatestFrom(this.store.select(selectStepperState)),
      tap(([action, stepperState]) => {
        this.localStorageService.saveStepperData(stepperState);
      })
    ), { dispatch: false }
  );

  restoreLocalStorageData$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StepperActions.restoreLocalStorageData),
        filter(() => this.localStorageService.hasExistingData()),
        map(() => {
          const data = this.localStorageService.getStepperData();
          return StepperActions.setStepperData({ data: data });
        }),
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
      map(() => StepperActions.uploadFileToOrder())
    );
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
      ofType(StepperActions.invoiceUploadSubmitFlowSuccess,StepperActions.uploadFileToOrder),
      switchMap(() => this.repositoryService.calculatePackageDetail().pipe(
        map((response) => StepperActions.calculatePackageDetailSuccess({
          packages: response.packageDetails,
          remainingOrderDetails: response.remainingOrderDetails
        })
        )
      ))
    ));


  invoiceUploadCompleted$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.calculatePackageDetailSuccess),
      map(() => StepperActions.setStepCompleted({ stepIndex: 1 }))
    )
  );

  uploadInvoiceFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.uploadFileToOrder),
      withLatestFrom(this.store.select(selectOrder)),
      switchMap(([action, order]) => this.fileUploadManager.uploadFileToOrder(order.id).pipe(
        map(() => StepperActions.invoiceUploadSubmitFlowSuccess()),
        catchError((error) => of(StepperActions.setGlobalError({ error: error.message })))
      ))
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

      ),
      map(() => StepperActions.stepperStepUpdated())
    )
  )


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
        StepperActions.palletControlSubmitSuccess
      ),
      map(() => StepperActions.stepperStepUpdated())
    )
  )

  uploadInvoiceProcessFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.uploadInvoiceProcessFile),
      switchMap(() => this.fileUploadManager.uploadFile().pipe(
        mergeMap(response => {
          return of(
            StepperActions.initializeStep1StateFromUpload({
              order: response.order,
              orderDetails: response.orderDetail,
              hasFile: true,
              fileName: 'File Upload Result'
            }
            ),
            StepperActions.setStepLoading({
              stepIndex: 0,
              loading: false,
              operation: "file upload completed"
            }
            ),
            StepperActions.uploadInvoiceProcessFileSuccess()
          )
        }
        ),
        catchError((error) => of(StepperActions.setGlobalError({ error: error.message })))
      ))
    )
  );

  palletControlSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.palletControlSubmit),
      withLatestFrom(this.store.select(selectUiPackages)),
      switchMap(([action, uiPackages]) =>
        this.repositoryService.bulkCreatePackageDetail(uiPackages).pipe(
          map((response) => StepperActions.palletControlSubmitSuccess({ packageDetails: response.package_details })),
          catchError((error) => of(StepperActions.setGlobalError({ error: error.message })))
        )
      )
    )
  );
}
