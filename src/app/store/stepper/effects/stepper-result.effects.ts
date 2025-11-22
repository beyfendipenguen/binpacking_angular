import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, switchMap, catchError, withLatestFrom, concatMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';

import { AppState, selectOrderResult } from '../../index';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { ResultStepFacade } from '../facade/result-step.facade';
import { StepperUiActions } from '../actions/stepper-ui.actions';
import { StepperResultActions } from '../actions/stepper-result.actions';

@Injectable()
export class StepperResultEffects {
  private actions$ = inject(Actions);
  private store = inject(Store<AppState>);
  private repositoryService = inject(RepositoryService);
  private resultStepFacade = inject(ResultStepFacade);

  // Sonuç Submit İşlemi (Facade Kullanımı)
  resultStepSubmit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.resultStepSubmit),
      tap(() => console.log('[Result Step] Submit başlatıldı')),
      concatMap((action) =>
        this.resultStepFacade.submitResultStep(action.resetStepper).pipe(
          map(() => StepperResultActions.resultStepSubmitSuccess()),
          catchError((error) => {
            console.error('[Result Step] Hata:', error);
            return of(StepperResultActions.resultStepSubmitError({
              error: error.message || 'Submit hatası'
            }));
          })
        )
      )
    )
  );

  // Update Order Result
  updateOrderResult$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.updateOrderResult),
      withLatestFrom(this.store.select(selectOrderResult)),
      switchMap(([_, orderResult]) =>
        this.repositoryService.partialUpdateOrderResult(orderResult).pipe(
          map(() => StepperResultActions.createReportFile()),
          catchError((error) =>
            of(StepperUiActions.setGlobalError({
              error: { message: error.message, stepIndex: 3 }
            }))
          )
        )
      )
    )
  );

  // Complete Shipment
  completeShipment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.completeShipment),
      withLatestFrom(this.store.select(selectOrderResult)),
      switchMap(([action, orderResult]) =>
        this.repositoryService.partialUpdateOrderResult(action.orderResult).pipe(
          map(() => StepperUiActions.resetStepper()),
          catchError((error) =>
            of(StepperUiActions.setGlobalError({
              error: { message: error.message, stepIndex: 3 }
            }))
          )
        )
      )
    )
  );

  // Create Report File
  createReportFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StepperResultActions.createReportFile),
      switchMap(() =>
        this.repositoryService.createReport().pipe(
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
