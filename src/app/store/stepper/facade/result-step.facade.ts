import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, of } from 'rxjs';
import { concatMap, switchMap, tap, take, map } from 'rxjs/operators';
import { AppState} from '../..';
import { AuthService } from '../../../core/auth/services/auth.service';
import { selectIsOrderDetailsDirty, selectOrderDetailsChanges, selectOrderResult, selectPackageChanges } from '../stepper.selectors';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { StepperPackageActions } from '../actions/stepper-package.actions';
import { StepperOrderActions } from '../actions/stepper-order.actions';

/**
 * ResultStepFacade
 *
 * Result Step (Step 3) submit işlemlerini yöneten facade service.
 * Bu service, karmaşık iş mantığını effect'lerden ayırarak daha temiz
 * ve test edilebilir bir yapı sağlar.
 *
 * İş Akışı:
 * 1. OrderDetails güncellemelerini kaydet (eğer dirty ise)
 * 2. Package Details oluştur
 * 3. Order Result güncelle
 * 4. İsteğe bağlı logout işlemi
 * 5. Report file oluştur
 */
@Injectable()
export class ResultStepFacade {
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);
  private authService = inject(AuthService);

  /**
   * Result Step submit işlemini başlatır
   *
   * @param resetStepper - true ise işlem sonunda logout yapılır
   * @returns Observable<void> - Tüm işlemler tamamlandığında complete olur
   *
   * NOT: concatMap kullanarak her işlemin sırayla tamamlanmasını garanti ediyoruz
   */
  submitResultStep(resetStepper: boolean): Observable<void> {
    return of(void 0).pipe(
      // 1. Adım: OrderDetails güncellemelerini kaydet (eğer değişiklik varsa)
      concatMap(() => this.handleOrderDetailsUpdate()),

      // 2. Adım: Package Details oluştur
      concatMap(() => this.handlePackageDetailsCreation()),

      // 3. Adım: Order Result güncelle
      concatMap(() => this.handleOrderResultUpdate()),

      // 4. Adım: Logout işlemi (isteğe bağlı)
      tap(() => {
        if (resetStepper) {
          console.log('[ResultStepFacade] Logout işlemi başlatılıyor...');
          this.authService.clearLocalAndStore();
        }
      }),

      // 5. Adım: Report file oluşturma sinyalini gönder
      tap(() => {
        console.log('[ResultStepFacade] Report file oluşturma başlatılıyor...');
        this.store.dispatch(StepperResultActions.createReportFile());
      })
    );
  }

  /**
   * OrderDetails güncellemelerini handle eder
   *
   * İş Mantığı:
   * - Önce dirty flag'i kontrol et
   * - Eğer dirty ise: API'ye güncelleme isteği gönder ve state'i güncelle
   * - Değilse: Hiçbir şey yapma (EMPTY yerine of(void 0) kullanıyoruz)
   *
   * @private
   * @returns Observable<void>
   */
  private handleOrderDetailsUpdate(): Observable<void> {
    return this.store.select(selectIsOrderDetailsDirty).pipe(
      take(1), // Sadece 1 kere değeri al ve complete ol
      concatMap(isDirty => {
        if (!isDirty) {
          console.log('[ResultStepFacade] OrderDetails temiz, güncelleme atlanıyor');
          return of(void 0);
        }

        console.log('[ResultStepFacade] OrderDetails güncellemesi başlatılıyor...');
        return this.updateOrderDetails();
      })
    );
  }

  /**
   * OrderDetails güncellemelerini API'ye gönderir
   *
   * @private
   * @returns Observable<void>
   */
  private updateOrderDetails(): Observable<void> {
    return this.store.select(selectOrderDetailsChanges).pipe(
      take(1),
      switchMap(changes => {
        console.log('[ResultStepFacade] OrderDetails API isteği gönderiliyor...', changes);

        return this.repositoryService.bulkUpdateOrderDetails(changes).pipe(
          tap(result => {
            console.log('[ResultStepFacade] OrderDetails başarıyla güncellendi', result);

            // Success action'ını dispatch et
            this.store.dispatch(
              StepperOrderActions.updateOrderDetailsSuccess({
                orderDetails: result.order_details
              })
            );
          }),
          map(() => void 0) // Response'u void'e çevir
        );
      })
    );
  }

  /**
   * Package Details oluşturma işlemini handle eder
   *
   * İş Mantığı:
   * - UiPackages state'inden paketleri al
   * - API'ye bulk create isteği gönder
   * - Success action'ını dispatch et
   *
   * @private
   * @returns Observable<void>
   */
  /**
   * Package Details oluşturma işlemini handle eder
   *
   * GÜNCELLEME: Artık changes bazlı çalışıyor
   */
  private handlePackageDetailsCreation(): Observable<void> {
    return this.store.select(selectPackageChanges).pipe( // ✅ Changes'leri al
      take(1),
      switchMap(packageChanges => {
        console.log('[ResultStepFacade] Package Details kaydediliyor...', {
          added: packageChanges.added.length,
          modified: packageChanges.modified.length,
          deletedIds: packageChanges.deletedIds.length
        });

        // ✅ Yeni method: bulkUpdatePackageDetails
        return this.repositoryService.bulkUpdatePackageDetails(packageChanges).pipe(
          tap(result => {
            console.log('[ResultStepFacade] Package Details başarıyla kaydedildi', result);

            // Success action'ını dispatch et
            this.store.dispatch(
              StepperPackageActions.createPackageDetailsSuccess({
                packageDetails: result.package_details
              })
            );
          }),
          map(() => void 0)
        );
      })
    );
  }

  /**
   * Order Result güncellemesini handle eder
   *
   * İş Mantığı:
   * - Order Result state'inden değeri al
   * - API'ye partial update isteği gönder
   * - Success durumunu logla
   *
   * @private
   * @returns Observable<void>
   */
  private handleOrderResultUpdate(): Observable<void> {
    return this.store.select(selectOrderResult).pipe(
      take(1),
      switchMap(orderResult => {
        console.log('[ResultStepFacade] Order Result güncellemesi başlatılıyor...', orderResult);

        return this.repositoryService.partialUpdateOrderResult(orderResult).pipe(
          tap(result => {
            console.log('[ResultStepFacade] Order Result başarıyla güncellendi', result);
          }),
          map(() => void 0)
        );
      })
    );
  }
}
