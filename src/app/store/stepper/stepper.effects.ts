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
  take,
} from 'rxjs/operators';
import { EMPTY, forkJoin, of } from 'rxjs';
import * as StepperActions from './stepper.actions';
import {
  AppState,
  selectOrder,
  selectOrderDetailsChanges,
  selectIsOrderDetailsDirty,
  selectOrderResult,
  selectStepperState,
  selectVerticalSort,
  selectIsOrderDirty,
  selectFileExists,
  selectCompanyRelationId,
  selectPackageChanges,
  selectIsPackagesDirty,
} from '../index';
import { ResultStepFacade } from './facade/result-step.facade';
import { mapPackageDetailToPackage } from '@features/mappers/package-detail.mapper';
import { OrderDetailService } from '@features/services/order-detail.service';
import { OrderService } from '@features/services/order.service';
import { FileUploadManager } from '@features/stepper/components/invoice-upload/managers/file-upload.manager';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { LocalStorageService } from '@features/stepper/services/local-storage.service';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { ToastService } from '@core/services/toast.service';
import { OrderActions } from './actions/order.actions';
import { PackageDetailActions } from './actions/package-detail.actions';
import { OrderDetailActions } from './actions/order-detail.actions';
import { concat } from 'lodash';

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
  private resultStepFacade = inject(ResultStepFacade);


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
          console.error(error.message);
        })
      ),
    { dispatch: false }
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

  enableEditMode$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.enableEditMode),
      // 1. Düzeltme: mergeMap yerine switchMap (Race condition engellemek için)
      switchMap((action) => {
        return forkJoin({
          order: this.orderService.getById(action.orderId),
          orderDetails: this.orderDetailService.getByOrderId(action.orderId),
          packages: this.repositoryService.getPackageDetails(action.orderId).pipe(
            map((packageDetails) => mapPackageDetailToPackage(packageDetails))
          ),
        }).pipe(
          // Başarılı durum: 3 action'ı peş peşe fırlatır
          switchMap(({ order, orderDetails, packages }) => [ // 'of' yerine array dönüp switchMap ile yakalamak daha okunabilir (veya sizin yaptığınız gibi 'of' da olur)
            OrderActions.saveSuccess({ order }),
            StepperActions.updateOrderDetailsSuccess({ orderDetails }),
            StepperActions.setUiPackages({ packages })
          ]),

          // 2. Düzeltme: Hata yakalama (Effect'in ölmemesi için KRİTİK)
          catchError((error) =>
            of(StepperActions.setGlobalError({ error }))
          )
        );
      })
    )
  );


  saveOrderSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrderActions.save),
      withLatestFrom(
        this.store.select(selectOrder),
        this.store.select(selectIsOrderDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([action, order]) => {
        return this.orderService.updateOrCreate(order).pipe(
          map((result) =>
            OrderActions.saveSuccess({
              order: result.order
            })
          ),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        );
      }
      )
    ),
  );

  orderDetailsUpsertMany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrderDetailActions.upsertMany),
      withLatestFrom(
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([action, changes]) =>
        this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          map((result) =>
            OrderDetailActions.upsertManySuccess({
              orderDetails: result.order_details
            })
          ),
          catchError((error) =>
            of(OrderDetailActions.upsertManyFailure({ error: error.message }))
          )
        )
      )
    )
  );

  packageDetailsUpsertMany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PackageDetailActions.upsertMany),
      withLatestFrom(
        this.store.select(selectPackageChanges),
        this.store.select(selectIsPackagesDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([action, changes]) =>
        this.repositoryService.bulkUpdatePackageDetails(changes).pipe(
          map((result) =>
            PackageDetailActions.upsertManySuccess({
              packageDetails: result.package_details
            })
          ),
          catchError((error) =>
            of(OrderDetailActions.upsertManyFailure({ error: error.message }))
          )
        )
      )
    )
  );



  triggerCreateOrderDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OrderActions.saveSuccess),
      map(() => OrderDetailActions.upsertMany()),
    )
  );


  triggerGetPallets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.uploadInvoiceProcessFileSuccess),
      map(() => StepperActions.getPallets())
    )
  );

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
      ofType(OrderActions.saveSuccess),
      withLatestFrom(this.store.select(selectFileExists)),
      filter(([action, fileExists]) => fileExists),
      map((action) => OrderActions.uploadFileToOrder())
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
      ofType(OrderActions.uploadFileToOrder),
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
          map(() => OrderActions.uploadFileToOrderSuccess()),
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
        OrderActions.set,
        StepperActions.uploadInvoiceProcessFileSuccess,
        StepperActions.addOrderDetail,
        StepperActions.updateOrderDetail,
        StepperActions.deleteOrderDetail,
        OrderActions.uploadFileToOrderSuccess,
        StepperActions.createOrderDetailsSuccess,
        OrderActions.saveSuccess,
        StepperActions.calculatePackageDetailSuccess,
        StepperActions.createPackageDetailsSuccess,
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
              StepperActions.uploadInvoiceProcessFileSuccess(),
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
        StepperActions.updateProductCountAndCreateOrUpdateOrderDetail,
        StepperActions.deleteOrderDetail,
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
      map(() => OrderActions.save()),
      catchError((error) =>
        of(StepperActions.setGlobalError({ error: error.message }))
      )
    )
  );


  palletControlSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.palletControlSubmit),
      switchMap((action) =>
        of(PackageDetailActions.upsertMany()).pipe(
          concatMap(() =>
            this.actions$.pipe(
              ofType(PackageDetailActions.upsertManySuccess),
              take(1),
              map(() => OrderDetailActions.upsertMany())
            )
          ),
          concatMap(() =>
            this.actions$.pipe(
              ofType(OrderDetailActions.upsertManySuccess),
              take(1),
              map(() => StepperActions.setStepCompleted({ stepIndex: 2 }))
            )
          )
        )
      )
    )
  );

  /**
   * Result Step Submit Effect
   *
   * Karmaşık iş mantığını ResultStepFacade'e delege eder.
   * Effect sadece action'ları dinler ve facade'i çağırır.
   *
   * İş Akışı:
   * 1. resultStepSubmit action'ını dinle
   * 2. Facade'in submitResultStep metodunu çağır
   * 3. Başarı durumunda: resultStepSubmitSuccess dispatch et
   * 4. Hata durumunda: setGlobalError dispatch et
   *
   * NOT: concatMap kullanarak aynı anda birden fazla submit işleminin
   * çalışmasını engelliyor ve sıralı işlem garantisi sağlıyoruz.
   */
  resultStepSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.resultStepSubmit),

      // Loading state'ini aktif et
      tap(action => {
        console.log('[Effect] Result Step Submit başlatıldı', {
          resetStepper: action.resetStepper
        });
      }),

      // Facade'i çağır (concatMap ile sıralı işlemi garanti et)
      concatMap(action =>
        this.resultStepFacade.submitResultStep(action.resetStepper).pipe(
          // Başarı durumu
          map(() => {
            console.log('[Effect] Result Step Submit başarıyla tamamlandı');

            return StepperActions.resultStepSubmitSuccess();
          }),

          // Hata durumu
          catchError(error => {
            console.error('[Effect] Result Step Submit hatası:', error);

            return of(
              StepperActions.setGlobalError({
                error: {
                  message: error.message || 'Result step submit sırasında hata oluştu',
                  stepIndex: 3
                }
              })
            );
          })
        )
      )
    )
  );

  /**
   * Package Changes Effect
   *
   * Package'larla ilgili her türlü değişiklikten sonra
   * calculatePackageChanges action'ını tetikler.
   *
   * Bu effect OrderDetails'teki orderDetailChanges$ effect'i ile aynı mantıkta çalışır.
   *
   * Tetikleme Senaryoları:
   * - Drag-drop işlemleri (pallet, product hareketleri)
   * - Package ekleme/silme işlemleri
   * - Product ekleme/silme işlemleri
   * - Alignment değişiklikleri
   * - Split işlemleri
   *
   * İş Akışı:
   * 1. Aşağıdaki action'lardan biri tetiklenir
   * 2. Effect bu action'ı yakalar
   * 3. calculatePackageChanges action'ını dispatch eder
   * 4. Reducer bu action'ı alıp changes'leri hesaplar ve state'e yazar
   *
   * NOT: Burada catchError kullanıyoruz çünkü selector hesaplama sırasında
   * beklenmedik bir hata olursa sistemi çökertmemek istiyoruz.
   */
  packageChanges$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        // Drag-Drop: Pallet İşlemleri
        StepperActions.movePalletToPackage,
        StepperActions.removePalletFromPackage,

        // Drag-Drop: Product İşlemleri (Paketler Arası)
        StepperActions.moveUiProductInPackageToPackage,
        StepperActions.movePartialProductBetweenPackages,

        // Drag-Drop: Product İşlemleri (Paket İçi)
        StepperActions.moveUiProductInSamePackage,

        // Drag-Drop: Remaining Products İşlemleri
        StepperActions.moveRemainingProductToPackage,
        StepperActions.movePartialRemainingProductToPackage,
        StepperActions.moveProductToRemainingProducts,
        StepperActions.remainingProductMoveProduct,

        // Package İşlemleri
        StepperActions.removePackage,
        StepperActions.removeAllPackage,
        StepperActions.removeProductFromPackage,

        // Product İşlemleri
        StepperActions.splitProduct,
        StepperActions.addUiProductToRemainingProducts,
        StepperActions.deleteRemainingProduct,

        // Alignment Değişiklikleri
        StepperActions.setVerticalSortInPackage,

        // Product Count Güncellemeleri
        StepperActions.updateProductCountAndCreateOrUpdateOrderDetail,
      ),
      tap(() => {
        console.log('[packageChanges$ Effect] Package değişikliği tespit edildi, changes hesaplanacak');
      }),
      map(() => StepperActions.calculatePackageChanges()),
      catchError((error) => {
        console.error('[packageChanges$ Effect] Hata:', error);
        return of(
          StepperActions.setGlobalError({
            error: {
              message: error.message || 'Package changes hesaplanırken hata oluştu',
              stepIndex: 2
            }
          })
        );
      })
    )
  );

}
