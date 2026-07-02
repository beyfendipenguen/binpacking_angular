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
  selectOrder,
  selectOrderResult,
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
import { calculatePackageTotalWeight } from '@app/features/utils/package-weight.util';

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
        this.store.select(selectOrderResult),
        this.store.select(selectOrder),
      ),
      filter(([_, orderResultId]) => !!orderResultId),
      map(([action, _, originalPackages, currentDeletedRows,
        shipments, isMultiShipment, orderResult, order]) => {
        const changes = action.changes ?? { added: [], modified: [], deletedIds: [] };
        const modifiedIds = new Set(changes.modified.map((p: any) => p.id));

        const backendPackageIds = new Set(originalPackages.map(p => p.id));

        // FIX: tek sevkiyatta orderResult da "sistemde var" sayılır
        const truckRows = isMultiShipment ? shipments.flat() : orderResult;
        const truckPkgIds = new Set(truckRows.map(r => r[8]));
        const deletedPkgIds = new Set(currentDeletedRows.map(r => r[8]));
        const allKnownPkgIds = new Set([...truckPkgIds, ...deletedPkgIds]);
        const makeRow = (pkg: any): PackagePosition => [
          -1, -1, -1,
          Number(pkg.pallet?.dimension?.depth || 0),
          Number(pkg.pallet?.dimension?.width || 0),
          Number(pkg.pallet?.dimension?.height || 0),
          Number(pkg.name),
          calculatePackageTotalWeight(pkg, order),   // ← 0 yerine
          pkg.id
        ] as PackagePosition;

        // 1) Mevcut deleted satırları: backend'de silinenleri at,
        //    modified olanların boyut/name'ini yenile, diğerlerinin name'ini güncelle
        const updatedDeletedRows = currentDeletedRows
          .filter(row => backendPackageIds.has(row[8]))
          .map(row => {
            const backendPkg = originalPackages.find(p => p.id === row[8]);
            if (!backendPkg) return row;
            if (modifiedIds.has(backendPkg.id)) return makeRow(backendPkg);
            return [row[0], row[1], row[2], row[3], row[4], row[5],
            Number(backendPkg.name), row[7], row[8]] as PackagePosition;
          });

        // 2) Yeni eklenen paketler (sistemde hiç yok) → deleted havuzu
        const newRows = originalPackages
          .filter(p => !allKnownPkgIds.has(p.id))
          .map(makeRow);

        // 3) Modified olup şu an kamyonda duranlar → kamyondan çıkar, havuza koy
        const movedRows = originalPackages
          .filter(p => modifiedIds.has(p.id)
            && truckPkgIds.has(p.id)
            && !deletedPkgIds.has(p.id))
          .map(makeRow);

        // Kamyondan çıkarılacaklar: backend'de silinenler + modified olanlar
        const removedPkgIds = [
          ...changes.deletedIds,
          ...movedRows.map(r => r[8] as string)
        ];

        return StepperResultActions.applyBackendSync({
          deletedPackages: [...updatedDeletedRows, ...newRows, ...movedRows],
          removedPkgIds
        });
      })
    )
  );
}