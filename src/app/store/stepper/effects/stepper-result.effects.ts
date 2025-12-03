import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, tap } from 'rxjs/operators';
import { of, filter } from 'rxjs';

import { AppState, selectHasRevisedOrder, selectIsEditMode, selectStep3IsDirty } from '../../index';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { OrderService } from '@app/features/services/order.service';

@Injectable()
export class StepperResultEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);
  private oderService = inject(OrderService);

  // is dirty degilse ise reset stepepr/
  // is dirty ise backend git gel rest stepper true mu bak
  // ona gore yap
  resultStepSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.resultStepSubmit),
      withLatestFrom(
        this.store.select(selectStep3IsDirty),
        this.store.select(selectIsEditMode),
        this.store.select(selectHasRevisedOrder)
      ),
      tap(([action]) => {
        if (action.resetStepper) {
          this.store.dispatch(StepperUiActions.resetStepper())
        }
      }),
      filter(([, isDirty]) => isDirty),
      switchMap(([action, , isEditMode, hasRevised]) => {
        // Önce reviseOrder çalışsın (eğer edit mode ise)
        if (isEditMode && !hasRevised) {
          return this.oderService.reviseOrder(action.orderId).pipe(
            switchMap(() =>
              this.repositoryService.partialUpdateOrderResult(action.orderResult)
            ),
            map(() => action) // action'ı taşı
          );
        }

        // Edit mode değilse direkt partialUpdate
        return this.repositoryService.partialUpdateOrderResult(action.orderResult).pipe(
          map(() => action) // action'ı taşı
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

}
