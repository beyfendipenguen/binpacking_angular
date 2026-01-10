import {
  Component, inject, ViewChild, OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import { StepperOrientation, MatStepperModule, MatStepper } from '@angular/material/stepper';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AsyncPipe, CommonModule } from '@angular/common';
import { StepperSelectionEvent } from '@angular/cdk/stepper';

// Components
import { InvoiceUploadComponent } from './components/invoice-upload/invoice-upload.component';
import { PalletControlComponent } from './components/pallet-control/pallet-control.component';
import { ResultStepComponent } from './components/result-step/result-step.component';

import { Store } from '@ngrx/store';

// Legacy services
import { LocalStorageService } from './services/local-storage.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '@core/services/toast.service';
import { LoadingComponent } from '@shared/loading/loading.component';
import { AppState, selectCompletedStep, selectIsEditMode, selectCurrentStep } from '@app/store';
import { StepperUiActions } from '@app/store/stepper/actions/stepper-ui.actions';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-stepper',
  imports: [
    MatStepperModule, FormsModule, LoadingComponent, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, AsyncPipe,
    InvoiceUploadComponent, PalletControlComponent, LoadingComponent,
    ResultStepComponent, CommonModule, TranslateModule
  ],
  providers: [
  ],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepperComponent implements OnInit {

  @ViewChild('stepper') stepper!: MatStepper;
  private readonly localStorageService = inject(LocalStorageService);
  private readonly legacyToastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  private readonly store = inject(Store<AppState>);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  public completedStepsSignal = this.store.selectSignal(selectCompletedStep);
  public isEditModeSignal = this.store.selectSignal(selectIsEditMode);

  public selectedIndex = this.store.select(selectCurrentStep)

  public stepperOrientation: Observable<StepperOrientation>;


  constructor() {
    const breakpointObserver = inject(BreakpointObserver);

    this.stepperOrientation = breakpointObserver
      .observe('(min-width: 800px)')
      .pipe(
        map(({ matches }) => matches ? 'horizontal' : 'vertical'),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      );

  }

  onShipmentCompleted = (): void => {
    try {
      this.router.navigate(['/'], {
        replaceUrl: true,
        queryParams: {}
      });
    } catch (error) {
    }
  };

  onStepChange(event: StepperSelectionEvent): void {
    this.store.dispatch(StepperUiActions.navigateToStep({ stepIndex: event.selectedIndex }))
  }

  ngOnInit(): void {
    const editModeOrderId = this.route.snapshot.queryParamMap.get('orderId');
    const localData = this.localStorageService.getStepperData();
    const localOrderId = localData?.order?.id;
    if (!editModeOrderId) {
      return;
    } else if (editModeOrderId && editModeOrderId === localOrderId) {
      return;
    } else if (editModeOrderId) {
      this.store.dispatch(StepperUiActions.enableEditMode({ orderId: editModeOrderId }));
    }
  }
}
