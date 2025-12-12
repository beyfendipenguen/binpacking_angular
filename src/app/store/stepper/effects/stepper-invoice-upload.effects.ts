import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, mergeMap, filter } from 'rxjs/operators';
import { of } from 'rxjs';

import { StepperInvoiceUploadActions } from '../actions/stepper-invoice-upload.actions';
import { StepperUiActions } from '../actions/stepper-ui.actions';

import {
  AppState,
  selectOrder,
  selectIsOrderDirty,
  selectOrderDetailsChanges,
  selectIsOrderDetailsDirty,
  selectFileExists
} from '../../index';

import { OrderService } from '@features/services/order.service';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { FileUploadManager } from '@features/stepper/components/invoice-upload/managers/file-upload.manager';

@Injectable()
export class StepperInvoiceUploadEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private orderService = inject(OrderService);
  private repositoryService = inject(RepositoryService);
  private fileUploadManager = inject(FileUploadManager);

  // Dosya Yükleme Trigger
  triggerUploadFileToOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.saveSuccess, StepperInvoiceUploadActions.saveSuccess),
      withLatestFrom(this.store.select(selectFileExists)),
      filter(([_, fileExists]) => fileExists),
      map(() => StepperInvoiceUploadActions.uploadFileToOrder())
    )
  );

  // Dosya Yükleme İşlemi
  uploadFileToOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.uploadFileToOrder),
      withLatestFrom(this.store.select(selectOrder), this.store.select(selectFileExists)),
      filter(([_, __, fileExists]) => fileExists),
      switchMap(([_, order]) => {
        if (!order) return of(StepperUiActions.setGlobalError({ error: { message: 'Sipariş bulunamadı' } }));
        return this.fileUploadManager.uploadFileToOrder(order.id).pipe(
          map(() => StepperInvoiceUploadActions.uploadFileToOrderSuccess()),
          catchError((error) => of(StepperUiActions.setGlobalError({ error: { message: error.message } })))
        );
      })
    )
  );

  // Fatura Yükleme ve İşleme
  uploadInvoiceProcessFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.uploadInvoiceProcessFile),
      switchMap(() =>
        this.fileUploadManager.uploadFile().pipe(
          mergeMap((response) => of(
            StepperInvoiceUploadActions.initializeInvoiceUploadStateFromUpload({
              order: response.order,
              orderDetails: response.orderDetail,
              hasFile: true,
              fileName: 'File Upload Result',
            }),
            StepperInvoiceUploadActions.uploadInvoiceProcessFileSuccess(),
          )),
          catchError((error) => of(StepperUiActions.setGlobalError({ error: { message: error.error.error } })))
        )
      )
    )
  );

  // 1. Adım tamamlandığında verileri kaydet
  invoiceUploadStepSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.invoiceUploadStepSubmit),
      withLatestFrom(this.store.select(selectIsOrderDirty)), // Order kirli mi kontrol et
      switchMap(([, isOrderDirty]) => {
        if (isOrderDirty) {
          // Order kirli, senin kurduğun zinciri başlat
          return of(StepperInvoiceUploadActions.save());
        } else {
          // Order temiz, direkt detay kaydına atla!
          return of(StepperInvoiceUploadActions.upsertMany());
        }
      }),
      catchError((error) => of(StepperUiActions.setGlobalError({ error: { message: error.message } })))
    )
  );

  // Sipariş Kaydetme (Dirty Check ile)
  saveOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.save),
      withLatestFrom(
        this.store.select(selectOrder),
        this.store.select(selectIsOrderDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([_, order]) =>
        this.orderService.updateOrCreate(order).pipe(
          map((result) => StepperInvoiceUploadActions.saveSuccess({ order: result.order })),
          catchError((error) => of(StepperUiActions.setStepperError({ error: error.message })))
        )
      )
    )
  );

  // Sipariş kaydedildikten sonra detayları kaydetmeyi tetikle
  triggerCreateOrderDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.saveSuccess),
      map(() => StepperInvoiceUploadActions.upsertMany())
    )
  );

  // Sipariş Detaylarını Toplu Güncelleme
  orderDetailsUpsertMany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.upsertMany),
      withLatestFrom(
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([_, changes]) =>
        this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          map((result) => StepperInvoiceUploadActions.upsertManySuccess({ orderDetails: result.order_details })),
          catchError((error) => of(StepperInvoiceUploadActions.upsertManyFailure({ error: error.message })))
        )
      )
    )
  );

  completeInvoiceUploadStep$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperInvoiceUploadActions.upsertManySuccess),
      map(() => StepperUiActions.setStepCompleted({ stepIndex: 1 }))
    ))

  // Order Detail Değişikliklerini Hesapla
  orderDetailChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StepperInvoiceUploadActions.deleteOrderDetail,
        StepperInvoiceUploadActions.addOrderDetail,
        StepperInvoiceUploadActions.updateOrderDetail
      ),
      map(() => StepperInvoiceUploadActions.calculateOrderDetailChanges()),
      catchError((error) =>
        of(StepperUiActions.setGlobalError({ error: { message: error.message } }))
      )
    )
  );
}
