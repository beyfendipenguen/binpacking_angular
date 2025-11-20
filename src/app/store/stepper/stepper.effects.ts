import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  map,
  tap,
  take,
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
  selectOrderResult,
  selectStepperState,
  selectUiPackages,
  selectVerticalSort,
  selectIsOrderDirty,
  selectFileExists,
  selectCompanyRelationId,
  selectPackageChanges,
} from '../index';
import { ToastService } from '../../services/toast.service';
import { OrderService } from '../../admin/components/services/order.service';
import { OrderDetailService } from '../../admin/components/services/order-detail.service';
import { FileUploadManager } from '../../admin/components/stepper/components/invoice-upload/managers/file-upload.manager';
import { LocalStorageService } from '../../admin/components/stepper/services/local-storage.service';
import { RepositoryService } from '../../admin/components/stepper/services/repository.service';
import { AuthService } from '../../auth/services/auth.service';
import { mapPackageDetailToPackage } from '../../models/mappers/package-detail.mapper';
import { UiPallet } from '../../admin/components/stepper/components/ui-models/ui-pallet.model';
import { ResultStepFacade } from './facade/result-step.facade';

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
              StepperActions.saveOrderSuccess({
                order: order,
              }),
              StepperActions.updateOrderDetailsSuccess({ orderDetails: orderDetails }),
              StepperActions.setUiPackages({
                packages: packages,
              }));
          })
        )
      }))
  );


  updateOrCreateOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.saveOrder),
      withLatestFrom(
        this.store.select(selectOrder),
        this.store.select(selectIsOrderDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([action, order]) => {
        return this.orderService.updateOrCreate(order).pipe(
          map((result) =>
            StepperActions.saveOrderSuccess({
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

  updateOrderDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperActions.updateOrderDetails),
      withLatestFrom(
        this.store.select(selectOrderDetailsChanges),
        this.store.select(selectIsOrderDetailsDirty)
      ),
      filter(([, , isDirty]) => isDirty),
      switchMap(([action, changes]) =>
        this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          map((result) =>
            StepperActions.updateOrderDetailsSuccess({
              orderDetails: result.order_details
            })
          ),
          catchError((error) =>
            of(StepperActions.setStepperError({ error: error.message }))
          )
        )
      )
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
              orderDetails: result.order_details
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
      ofType(StepperActions.saveOrderSuccess),
      withLatestFrom(this.store.select(selectIsOrderDetailsDirty)),
      switchMap(([action, isOrderDetailsDirty]) => {
        if (isOrderDetailsDirty) {
          return of(
            StepperActions.createOrderDetails()
          );
        }
        return EMPTY;
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
      ofType(StepperActions.saveOrderSuccess),
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
        StepperActions.saveOrderSuccess,
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
              StepperActions.setStepLoading({
                stepIndex: 0,
                loading: false,
                operation: 'file upload completed',
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
      map(() => StepperActions.saveOrder()),
      catchError((error) =>
        of(StepperActions.setGlobalError({ error: error.message }))
      )
    )
  );


/**
 * Pallet Control Submit Effect
 *
 * İş Akışı:
 * 1. OrderDetails dirty ise → Kaydet
 * 2. Package changes'leri → Kaydet
 * 3. Her iki adımda da error handling
 *
 * NOT: bulkCreatePackageDetails$ effect'i SİLİNDİ, artık bu tek effect var
 */
palletControlSubmit$ = createEffect(() =>
  this.actions$.pipe(
    ofType(StepperActions.palletControlSubmit),
    withLatestFrom(
      this.store.select(selectPackageChanges),
      this.store.select(selectIsOrderDetailsDirty),
      this.store.select(selectOrderDetailsChanges),
    ),

    // Step 1: OrderDetails varsa kaydet
    concatMap(([action, packageChanges, isOrderDetailsDirty, orderDetailChanges]) => {
      console.log('[Effect] palletControlSubmit - Başlatılıyor:', {
        hasPackageChanges: packageChanges.added.length > 0 ||
                          packageChanges.modified.length > 0 ||
                          packageChanges.deletedIds.length > 0,
        isOrderDetailsDirty
      });

      // OrderDetails dirty değilse direkt package changes'e geç
      if (!isOrderDetailsDirty) {
        return of(packageChanges);
      }

      // OrderDetails dirty ise kaydet
      return this.repositoryService.bulkUpdateOrderDetails(orderDetailChanges).pipe(
        tap((result) => {
          console.log('[Effect] OrderDetails kaydedildi');
          this.store.dispatch(
            StepperActions.updateOrderDetailsChangesSuccess({
              orderDetails: result.order_details
            })
          );
        }),
        map(() => packageChanges), // ✅ PackageChanges'i döndür
        catchError((error) => {
          console.error('[Effect] OrderDetails kayıt hatası:', error);
          this.store.dispatch(
            StepperActions.setGlobalError({
              error: { message: error.message, stepIndex: 2 }
            })
          );
          return EMPTY; // ✅ Flow'u durdur (error durumunda devam etme)
        })
      );
    }),

    // Step 2: Package changes'leri kaydet
    concatMap((packageChanges) => { // ✅ Artık type güvenli
      console.log('[Effect] Package changes kaydediliyor:', {
        added: packageChanges.added.length,
        modified: packageChanges.modified.length,
        deleted: packageChanges.deletedIds.length
      });

      return this.repositoryService.bulkUpdatePackageDetails(packageChanges).pipe(
        map((result) => {
          console.log('[Effect] Package changes kaydedildi:', result);

          return StepperActions.palletControlSubmitSuccess({
            packageDetails: result.package_details
          });
        }),
        catchError((error) => {
          console.error('[Effect] Package changes kayıt hatası:', error);
          return of(
            StepperActions.setGlobalError({
              error: { message: error.message, stepIndex: 2 }
            })
          );
        })
      );
    })
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

        this.store.dispatch(
          StepperActions.setStepLoading({
            stepIndex: 3,
            loading: true,
            operation: 'result-step-submit'
          })
        );
      }),

      // Facade'i çağır (concatMap ile sıralı işlemi garanti et)
      concatMap(action =>
        this.resultStepFacade.submitResultStep(action.resetStepper).pipe(
          // Başarı durumu
          map(() => {
            console.log('[Effect] Result Step Submit başarıyla tamamlandı');

            // Loading state'ini kapat
            this.store.dispatch(
              StepperActions.setStepLoading({
                stepIndex: 3,
                loading: false,
                operation: 'result-step-submit'
              })
            );

            return StepperActions.resultStepSubmitSuccess();
          }),

          // Hata durumu
          catchError(error => {
            console.error('[Effect] Result Step Submit hatası:', error);

            // Loading state'ini kapat
            this.store.dispatch(
              StepperActions.setStepLoading({
                stepIndex: 3,
                loading: false,
                operation: 'result-step-submit'
              })
            );

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
