import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, tap } from 'rxjs/operators';
import { of, filter } from 'rxjs';

import {
  AppState,
  selectDeletedPackages,
  selectHasRevisedOrder,
  selectIsEditMode,
  selectIsMultiShipment,
  selectOrderResultId,
  selectOriginalPackages,
  selectShipments,
  selectStep3IsDirty,
  StepperPackageActions
} from '../../index';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { OrderService } from '@app/features/services/order.service';
import { AuthService } from '@app/core/auth/services/auth.service';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

@Injectable()
export class StepperResultEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);

  // Result Step Submit
  // orderResult artık { shipments: [{shipment, result}, ...] } formatında —
  // bkz. ResultStepService.formatAllShipmentsForResult
  resultStepSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.resultStepSubmit),
      withLatestFrom(
        this.store.select(selectStep3IsDirty),
        this.store.select(selectIsEditMode),
        this.store.select(selectHasRevisedOrder),
        this.store.select(selectOrderResultId)
      ),
      tap(([action]) => {
        if (action.resetStepper) {
          this.authService.clearLocalAndStore();
        }
      }),
      filter(([, isDirty]) => isDirty),
      switchMap(([action, , isEditMode, hasRevised, orderResultId]) => {
        if (isEditMode && !hasRevised) {
          return this.orderService.reviseOrder(action.orderId).pipe(
            tap(() => {
              this.store.dispatch(StepperUiActions.reviseOrderSuccess());
            }),
            switchMap(() =>
              this.repositoryService.partialUpdateOrderResult(orderResultId, action.orderResult)
            ),
            map(() => action)
          );
        }

        return this.repositoryService.partialUpdateOrderResult(orderResultId, action.orderResult).pipe(
          map(() => action)
        );
      }),
      map((action) => StepperResultActions.createReportFile({ orderId: action.orderId })),
      catchError((error) =>
        of(StepperUiActions.setGlobalError({
          error: { message: error.message, stepIndex: 3 }
        }))
      )
    )
  );

  // Create Report File
  createReportFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.createReportFile),
      switchMap((action) =>
        this.repositoryService.createReport(action.orderId).pipe(
          map((response) => StepperResultActions.createReportFileSuccess({ reportFiles: response.files })),
          catchError((error) =>
            of(StepperUiActions.setGlobalError({
              error: { message: error.message, stepIndex: 3 }
            }))
          )
        )
      )
    )
  );

  /**
   * Step 2'de paket eklendiğinde/değiştiğinde, bu yeni paketleri global
   * deletedPackages havuzuna (store) ekler. Çoklu sevkiyatın TÜMÜNDE
   * senkron olmalı — sadece aktif shipment'ta değil, bu yüzden kaynak
   * olarak PackagesStateService (runtime/local) DEĞİL, store kullanılır.
   */
  syncBackendPackages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.upsertManySuccess),
      withLatestFrom(
        this.store.select(selectOrderResultId),
        this.store.select(selectOriginalPackages),
        this.store.select(selectDeletedPackages),
        this.store.select(selectShipments),
        this.store.select(selectIsMultiShipment),
      ),
      filter(([action, orderResultId]) => !!orderResultId),
      map(([action, orderResultId, originalPackages, currentDeletedRows, shipments, isMultiShipment]) => {
        // Sistemde (herhangi bir shipment'ta veya deleted'ta) var olan tüm pkgId'ler
        const allShipmentPkgIds = new Set(
          (isMultiShipment ? shipments : []).flat().map(row => row[8])
        );
        const deletedPkgIds = new Set(currentDeletedRows.map(row => row[8]));
        const allKnownPkgIds = new Set([...allShipmentPkgIds, ...deletedPkgIds]);

        const backendPackageIds = new Set(originalPackages.map(p => p.id));

        // 1. Deleted satırlarında name (id) güncellemesi gerekiyorsa uygula
        const updatedDeletedRows = currentDeletedRows.map(row => {
          const backendPkg = originalPackages.find(p => p.id === row[8]);
          if (backendPkg) {
            return [row[0], row[1], row[2], row[3], row[4], row[5], Number(backendPkg.name), row[7], row[8]] as PackagePosition;
          }
          return row;
        });

        // 2. Backend'de yeni eklenmiş, sistemde hiç olmayan paketleri deleted'a ekle
        const newRows: PackagePosition[] = [];
        originalPackages.forEach(backendPkg => {
          if (!allKnownPkgIds.has(backendPkg.id)) {
            const depth = Number(backendPkg.pallet?.dimension?.depth || 0);
            const width = Number(backendPkg.pallet?.dimension?.width || 0);
            const height = Number(backendPkg.pallet?.dimension?.height || 0);

            newRows.push([
              -1, -1, -1,
              depth, width, height,
              Number(backendPkg.name), 0, backendPkg.id
            ] as PackagePosition);
          }
        });

        // 3. Backend'de artık olmayan paketleri deleted'tan çıkar
        //    (shipment'larda olanlara dokunulmaz, ayrı akışla yönetilir)
        const finalDeletedRows = [...updatedDeletedRows, ...newRows]
          .filter(row => backendPackageIds.has(row[8]));

        return StepperResultActions.setDeletedPackages({ deletedPackages: finalDeletedRows });
      })
    )
  );
}