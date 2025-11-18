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
  exhaustMap,
} from 'rxjs/operators';
import { EMPTY, forkJoin, of, timer } from 'rxjs';
import * as StepperActions from './stepper.actions';
import {
  AppState,
  selectOrder,
  selectOrderDetailsChanges,
  selectIsOrderDetailsDirty,
  selectStep2IsDirty,
  selectOrderResult,
  selectStepperState,
  selectUiPackages,
  selectVerticalSort,
  selectIsOrderDirty,
  selectFileExists,
  selectCompanyRelationId,
  selectPackages,
} from '../index';
import { ToastService } from '../../services/toast.service';
import { OrderService } from '../../admin/components/services/order.service';
import { OrderDetailService } from '../../admin/components/services/order-detail.service';
import { FileUploadManager } from '../../admin/components/stepper/components/invoice-upload/managers/file-upload.manager';
import { LocalStorageService } from '../../admin/components/stepper/services/local-storage.service';
import { RepositoryService } from '../../admin/components/stepper/services/repository.service';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../auth/services/auth.service';
import { mapPackageDetailToPackage } from '../../models/mappers/package-detail.mapper';
import { UiPallet } from '../../admin/components/stepper/components/ui-models/ui-pallet.model';

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
  private authService = inject(AuthService);


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
          packages:
            this.repositoryService.getPackageDetails(action.orderId).pipe(
              map((packageDetails) => mapPackageDetailToPackage(packageDetails))
            ),
        }).pipe(
          mergeMap(({ order, orderDetails, packages }) => {
            return of(
              StepperActions.updateOrCreateOrderSuccess({
                order: order,
                context: "editmode"
              }),
              StepperActions.updateOrderDetailsChangesSuccess({ orderDetails: orderDetails }),
              StepperActions.setUiPackages({
                packages: packages,
              }));
          })
        )
      }))
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

  updateOrCreateOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrCreateOrder),
      withLatestFrom(
        this.store.select(selectOrder),
        this.store.select(selectIsOrderDirty)
      ),
      switchMap(([action, order, isDirty]) => {
        if (isDirty) {
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
        }
        return of(StepperActions.updateOrderDetailsChanges({}));
      })
    )
  );

  updateOrderDetailChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrderDetailsChanges),
      withLatestFrom(
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty)
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
      withLatestFrom(this.store.select(selectOrderDetailsChanges)),
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



  triggerCreateOrderDetails$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.updateOrCreateOrderSuccess),
      withLatestFrom(this.store.select(selectIsOrderDetailsDirty)),
      switchMap(([action, isOrderDetailsDirty]) => {
        // Context kontrolü
        if (isOrderDetailsDirty) {
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


  triggerGetPallets$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.uploadInvoiceProcessFileSuccess),
      map(() => StepperActions.getPallets())
    )
  });

  getPallets$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.getPallets),
      withLatestFrom(this.store.select(selectCompanyRelationId)),
      filter(([_, companyRelationId]) => !!companyRelationId),
      switchMap(() =>
        this.repositoryService.getPalletsByCompanyRelation().pipe(
          map(results => results.map(pallet => new UiPallet(pallet))),
          map((response) => StepperActions.getPalletsSuccess({ pallets: response })),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        )
      )
    )
  });

  triggerUploadFileToOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrCreateOrderSuccess),
      withLatestFrom(this.store.select(selectFileExists)),
      filter(([action, fileExists]) => fileExists),
      map((action) => StepperActions.uploadFileToOrder({}))
    )
  );

  calculatePackageDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.calculatePackageDetail),
      withLatestFrom(this.store.select(selectVerticalSort)),
      switchMap(([action, verticalSort]) =>
        this.repositoryService.calculatePackageDetails(verticalSort).pipe(
          map(response => ({
            uiPackages: mapPackageDetailToPackage(response.package_details),
          })),
          map((response) =>
            StepperActions.calculatePackageDetailSuccess({
              packages: response.uiPackages,
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
      map(() => StepperActions.setStepCompleted({ stepIndex: 1 }))
    )
  );

  uploadFileToOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.uploadFileToOrder),
      withLatestFrom(
        this.store.select(selectOrder),
        this.store.select(selectFileExists)
      ),
      filter(([_, order, fileExists]) => fileExists),
      switchMap(([action, order]) => {
        if (!order) {
          return of(StepperActions.setGlobalError({ error: { message: 'Order not found' } }));
        }
        return this.fileUploadManager.uploadFileToOrder(order.id).pipe(
          map(() => StepperActions.uploadFileToOrderSuccess()),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          )
        )
      })
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

  completeShipment$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.completeShipment),
      withLatestFrom(this.store.select(selectOrderResult)),
      switchMap(([action, orderResult]) => {
        return this.repositoryService.partialUpdateOrderResult(orderResult).pipe(
          map((response) =>
            StepperActions.resetStepper()
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

  syncInvoiceUploadStep$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.syncInvoiceUploadStep),
      map(() => StepperActions.updateOrCreateOrder({ context: 'syncInvoiceUploadStep' })),
      catchError((error) =>
        of(StepperActions.setGlobalError({ error: error.message }))
      )
    )
  );


  palletControlSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.palletControlSubmit),
      withLatestFrom(
        this.store.select(selectUiPackages),
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty),
        this.store.select(selectStep2IsDirty),
      ),
      filter(([action, uiPackages, changes, isOrderDetailsDirty, isPackageDetailsDirty]) => isPackageDetailsDirty),
      map(([action, uiPackages, changes, isOrderDetailsDirty, isPackageDetailsDirty]) => ({
        uiPackages, changes, isOrderDetailsDirty, isPackageDetailsDirty
      })),
      concatMap(payload => {
        if (!payload.isOrderDetailsDirty) {
          return of(payload)
        }
        return this.repositoryService.bulkUpdateOrderDetails(payload.changes).pipe(
          tap((result) => this.store.dispatch(StepperActions.updateOrderDetailsChangesSuccess({ orderDetails: result.order_details }))),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          ),
          map(() => payload),
        )
      }),
      concatMap(payload => {
        if (!payload.isPackageDetailsDirty) {
          return of(payload)
        }
        return this.repositoryService.bulkCreatePackageDetail(payload.uiPackages).pipe(
          tap((result) => this.store.dispatch(StepperActions.palletControlSubmitSuccess({ packageDetails: result.package_details }))),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          ),
          map(() => payload)
        )
      })
    ), { dispatch: false }
  );

  resultStepSubmit$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(StepperActions.resultStepSubmit),
      withLatestFrom(
        this.store.select(selectOrderResult),
        this.store.select(selectPackages),
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty),
        this.store.select(selectStep2IsDirty)
      ),
      map(([action, orderResult, packages, changes, isOrderDetailsDirty, isPackagesDirty]) => ({
        action,
        orderResult,
        packages,
        changes,
        isOrderDetailsDirty,
        isPackagesDirty
      })),
      concatMap(payload => {
        if (!payload.isOrderDetailsDirty) {
          return of(payload)
        }
        return this.repositoryService.bulkUpdateOrderDetails(payload.changes).pipe(
          tap((result) => this.store.dispatch(StepperActions.updateOrderDetailsChangesSuccess({ orderDetails: result.order_details }))),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          ),
          map(() => payload),
        )
      }),
      concatMap(payload => {
        if (!payload.isPackagesDirty) {
          return of(payload)
        }
        return this.repositoryService.bulkCreatePackageDetail(payload.packages).pipe(
          tap((result) => this.store.dispatch(StepperActions.palletControlSubmitSuccess({ packageDetails: result.package_details }))),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          ),
          map(() => payload)
        )
      }),
      concatMap(payload => {
        return this.repositoryService.partialUpdateOrderResult(payload.orderResult).pipe(
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          ),
          map(() => payload)
        )
      }),
      concatMap(payload => {
        return this.repositoryService.createReport().pipe(
          tap((result) => this.store.dispatch(StepperActions.createReportFileSuccess({ reportFiles: result.files }))),
          tap(() => {
            if (payload.action.resetStepper) {
              this.authService.clearLocalAndStore();
            }
          }),
          catchError((error) =>
            of(StepperActions.setGlobalError({ error: error.message }))
          )
        )
      }),
      catchError((error) =>
        of(StepperActions.setGlobalError({ error: error.message }))
      )
    )
  }, { dispatch: false });

}
