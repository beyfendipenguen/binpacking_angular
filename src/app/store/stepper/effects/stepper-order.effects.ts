import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, mergeMap, filter } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

import { OrderDetailActions } from '../actions/order-detail.actions';
import {
  AppState,
  selectOrder,
  selectIsOrderDirty,
  selectOrderDetailsChanges,
  selectIsOrderDetailsDirty,
  selectFileExists
} from '../../index';

import { OrderService } from '@features/services/order.service';
import { OrderDetailService } from '@features/services/order-detail.service';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { FileUploadManager } from '@features/stepper/components/invoice-upload/managers/file-upload.manager';
import { mapPackageDetailToPackage } from '@features/mappers/package-detail.mapper';
import { StepperOrderActions } from '../actions/stepper-order.actions';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';

@Injectable()
export class StepperOrderEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private orderService = inject(OrderService);
  private orderDetailService = inject(OrderDetailService);
  private repositoryService = inject(RepositoryService);
  private fileUploadManager = inject(FileUploadManager);

  // Edit Modu: Sipariş, detaylar ve paketleri paralel yükler
  enableEditMode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.enableEditMode),
      switchMap((action) =>
        forkJoin({
          order: this.orderService.getById(action.orderId),
          orderDetails: this.orderDetailService.getByOrderId(action.orderId),
          packages: this.repositoryService.getPackageDetails(action.orderId).pipe(
            map((details) => mapPackageDetailToPackage(details))
          ),
        }).pipe(
          switchMap(({ order, orderDetails, packages }) => [
            StepperOrderActions.saveSuccess({ order }),
            StepperOrderActions.updateOrderDetailsSuccess({ orderDetails }),
            StepperPackageActions.setUiPackages({ packages })
          ]),
          catchError((error) => of(StepperUiActions.setGlobalError({ error })))
        )
      )
    )
  );

  // Fatura Yükleme ve İşleme
  uploadInvoiceProcessFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.uploadInvoiceProcessFile),
      switchMap(() =>
        this.fileUploadManager.uploadFile().pipe(
          mergeMap((response) => of(
            StepperOrderActions.initializeStep1StateFromUpload({
              order: response.order,
              orderDetails: response.orderDetail,
              hasFile: true,
              fileName: 'File Upload Result',
            }),
            StepperOrderActions.uploadInvoiceProcessFileSuccess(),
          )),
          catchError((error) => of(StepperUiActions.setGlobalError({ error: error.message })))
        )
      )
    )
  );

  // 1. Adım tamamlandığında verileri kaydet
  syncInvoiceUploadStep$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.syncInvoiceUploadStep),
      map(() => StepperOrderActions.save()),
      catchError((error) => of(StepperUiActions.setGlobalError({ error: error.message })))
    )
  );

  // Sipariş Kaydetme (Dirty Check ile)
  saveOrderSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.save),
      withLatestFrom(
        this.store.select(selectOrder),
        this.store.select(selectIsOrderDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([_, order]) =>
        this.orderService.updateOrCreate(order).pipe(
          map((result) => StepperOrderActions.saveSuccess({ order: result.order })),
          catchError((error) => of(StepperUiActions.setStepperError({ error: error.message })))
        )
      )
    )
  );

  // Sipariş kaydedildikten sonra detayları kaydetmeyi tetikle
  triggerCreateOrderDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.saveSuccess),
      map(() => OrderDetailActions.upsertMany())
    )
  );

  // Sipariş Detaylarını Toplu Güncelleme
  orderDetailsUpsertMany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrderDetailActions.upsertMany),
      withLatestFrom(
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([_, changes]) =>
        this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          map((result) => OrderDetailActions.upsertManySuccess({ orderDetails: result.order_details })),
          catchError((error) => of(OrderDetailActions.upsertManyFailure({ error: error.message })))
        )
      )
    )
  );

  // Fatura yüklendiğinde step 1'i tamamla
  invoiceUploadCompleted$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.createOrderDetailsSuccess),
      map(() => StepperUiActions.setStepCompleted({ stepIndex: 1 }))
    )
  );

  // Dosya Yükleme Trigger
  triggerUploadFileToOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.saveSuccess),
      withLatestFrom(this.store.select(selectFileExists)),
      filter(([_, fileExists]) => fileExists),
      map(() => StepperOrderActions.uploadFileToOrder())
    )
  );

  // Dosya Yükleme İşlemi
  uploadFileToOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperOrderActions.uploadFileToOrder),
      withLatestFrom(this.store.select(selectOrder), this.store.select(selectFileExists)),
      filter(([_, __, fileExists]) => fileExists),
      switchMap(([_, order]) => {
        if (!order) return of(StepperUiActions.setGlobalError({ error: { message: 'Order not found' } }));
        return this.fileUploadManager.uploadFileToOrder(order.id).pipe(
          map(() => StepperOrderActions.uploadFileToOrderSuccess()),
          catchError((error) => of(StepperUiActions.setGlobalError({ error: error.message })))
        );
      })
    )
  );
}
