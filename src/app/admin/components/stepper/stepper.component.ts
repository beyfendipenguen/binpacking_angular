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
import { MatProgressSpinner } from '@angular/material/progress-spinner';

// Components
import { InvoiceUploadComponent } from './components/invoice-upload/invoice-upload.component';
import { PalletControlComponent } from './components/pallet-control/pallet-control.component';
import { ResultStepComponent } from './components/result-step/result-step.component';

import { Store } from '@ngrx/store';

// Legacy services
import { LocalStorageService } from './services/local-storage.service';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingComponent } from '../../../components/loading/loading.component';
import { ToastService } from '../../../services/toast.service';
import { AppState } from '../../../store';
import * as StepperActions from '../../../store/stepper/stepper.actions';
import * as StepperSelectors from '../../../store/stepper/stepper.selectors';

@Component({
  selector: 'app-stepper',
  imports: [
    MatStepperModule, FormsModule, LoadingComponent, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, AsyncPipe,
    InvoiceUploadComponent, PalletControlComponent, LoadingComponent,
    ResultStepComponent, CommonModule
  ],
  providers: [
  ],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepperComponent implements OnInit {

  // View References
  @ViewChild('stepper') stepper!: MatStepper;
  private readonly localStorageService = inject(LocalStorageService);
  private readonly legacyToastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  private readonly store = inject(Store<AppState>);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  public completedStepsSignal = this.store.selectSignal(StepperSelectors.selectCompletedStep);
  public isEditModeSignal = this.store.selectSignal(StepperSelectors.selectIsEditMode);

  public selectedIndex = this.store.select(StepperSelectors.selectCurrentStep)

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
    this.store.dispatch(StepperActions.navigateToStep({ stepIndex: event.selectedIndex }))
  }


  ngOnInit(): void {
    // TODO:
    // localdan okuyup store a yazama islemini tamamla
    // edit mode senaryolarini dene
    // app component restore yapti ve busayfa acildi
    // eger edit mode dan geldiyse store u ezmesi gerekiyor.
    // eger edit mode dan geldiyse ve mevcut local data da bulunan step veri tabanina gimediyse ilk invoice upload component verisi varsa sadece
    // bu veri silinir ve uzerine edit mode dan gelen veriler yazilir.
    // eger kullanici ilerle ve kaydet demisse zaten ilgili isleme geri donmek icin duzenle butonunu
    // siparis sayfasindan tiklayarak gelebilir.
    // eger edit mode dan geldiyse ve store daki order id ayni ise  backende gitmeden devam etmesi lazim
    // bu durumda ekranda kullaniciya bu durumu bildirmek gerekir
    // bu zaten en  son yarim kalan siparisiniz demesi lazim bunun gibi bir bildirim cikmasi lazim
    // eger edit mode dan gelmediyse zaten app component her turlu store doldurmus oluyor herhangi bir problem yok


    const editModeOrderId = this.route.snapshot.queryParamMap.get('orderId');
    const localData = this.localStorageService.getStepperData();
    const localOrderId = localData?.order?.id;
    if (!editModeOrderId) {
      return;
    } else if (editModeOrderId && editModeOrderId === localOrderId) {
      this.legacyToastService.info("duzenlemek istediginiz siparis yarim kalan siparisinizdi", "edit mode ve local ayni")
      return;
    } else if (editModeOrderId) {
      this.store.dispatch(StepperActions.enableEditMode({ orderId: editModeOrderId }));
    }

  }


}
