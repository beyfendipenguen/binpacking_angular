import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, concatMap, tap } from 'rxjs/operators';
import { of, filter } from 'rxjs';

import { AppState, selectOrderId, selectOrderResult, selectStep3IsDirty } from '../../index';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { ResultStepFacade } from '../facade/result-step.facade';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperResultActions } from '../actions/stepper-result.actions';

@Injectable()
export class StepperResultEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);



  // Complete Shipment
  // is dirty degilse ise reset stepepr/
  // is dirty ise backend git gel rest stepper true mu bak 
  // ona gore yap
  resultStepSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.resultStepSubmit),
      withLatestFrom(this.store.select(selectStep3IsDirty)),
      tap(action => {
        if (action[0].resetStepper) {
          this.store.dispatch(StepperUiActions.resetStepper())
        }
      }),
      filter(([, isDirty]) => isDirty),
      switchMap(([action]) =>
        this.repositoryService.partialUpdateOrderResult(action.orderResult).pipe(
          map((response) => StepperResultActions.createReportFile({ orderId: action.orderId })),
          catchError((error) =>
            of(StepperUiActions.setGlobalError({
              error: { message: error.message, stepIndex: 3 }
            }))
          )
        ),
      )
    )
  );


  // Create Report File
  createReportFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.createReportFile),
      withLatestFrom(this.store.select(selectOrderId)),
      switchMap(([, orderId]) =>
        this.repositoryService.createReport(orderId).pipe(
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
