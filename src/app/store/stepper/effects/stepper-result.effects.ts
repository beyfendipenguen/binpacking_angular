import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, tap } from 'rxjs/operators';
import { of, filter } from 'rxjs';

import { AppState, selectHasRevisedOrder, selectIsEditMode, selectOrderResultId, selectPackages, selectStep2Changes, selectStep3IsDirty, StepperPackageActions } from '../../index';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { OrderService } from '@app/features/services/order.service';
import { AuthService } from '@app/core/auth/services/auth.service';
import { PackageData } from '@app/features/interfaces/order-result.interface';
import { PackagesStateService } from '@app/shared/threejs-truck-visualization/services/packages-state.service';

@Injectable()
export class StepperResultEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);
  private orderService = inject(OrderService);
  private authService = inject(AuthService);
  private packagesStateService = inject(PackagesStateService);

  // Result Step Submit

  // is dirty degilse ise reset stepepr/
  // is dirty ise backend git gel rest stepper true mu bak
  // ona gore yap
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
        // Önce reviseOrder çalışsın (eğer edit mode ise)
        if (isEditMode && !hasRevised) {
          return this.orderService.reviseOrder(action.orderId).pipe(
            tap(() => {
              this.store.dispatch(StepperUiActions.reviseOrderSuccess());
            }),
            switchMap(() =>
              this.repositoryService.partialUpdateOrderResult(orderResultId, action.orderResult),
            ),
            map(() => action)
          );
        }

        // Edit mode değilse direkt partialUpdate
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

  syncStep2Changes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperPackageActions.calculatePackageChanges),

      withLatestFrom(
        this.store.select(selectOrderResultId),
        this.store.select(selectStep2Changes),
        this.store.select(selectPackages)
      ),

      filter(([action, orderResultId]) => !!orderResultId),

      tap(([action, orderResultId, changes, packages]) => {
        if (changes.added.length > 0) {
          const newDeletedPackages: PackageData[] = changes.added.map(addedPkg => {
            const fullPackage = packages.find(p => p.id === addedPkg.id);

            const depth = Number(fullPackage?.pallet?.dimension?.depth || 0);
            const width = Number(fullPackage?.pallet?.dimension?.width || 0);
            const height = Number(fullPackage?.pallet?.dimension?.height || 0);

            return {
              id: Number(addedPkg.name),
              pkgId: addedPkg.id,
              x: -1,
              y: -1,
              z: -1,
              length: depth,
              width: width,
              height: height,
              weight: 0,
              color: '#808080',
              originalColor: '#808080',
              dimensions: `${depth}×${width}×${height}mm`,
              rotation: 0,
              originalLength: depth,
              originalWidth: width,
              isForcePlaced: false,
              isBeingDragged: false
            };
          });

          this.packagesStateService.addToDeletedPackages(newDeletedPackages);
        }

        if (changes.deleted.length > 0) {
          this.packagesStateService.removeFromBothLists(changes.deleted);
        }
      })
    ),
    { dispatch: false }
  );
}
