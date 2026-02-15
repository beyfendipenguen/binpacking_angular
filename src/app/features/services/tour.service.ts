import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import Shepherd, { Tour } from 'shepherd.js';
import { filter, distinctUntilChanged } from 'rxjs/operators';
import { selectCurrentStep, selectOrderResult, selectPackages } from '@app/store';
import { TranslateService } from '@ngx-translate/core';
import { TOUR_CONFIG, TourStepConfig } from './configs/tour.config';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TourService {
  private tour: Tour | null = null;
  private readonly DEMO_COMPANY_ID = "885b80c6-3d77-4b61-a5aa-a6b155eb2e42";
  private readonly DEBUG = !environment.production;

  constructor(
    private router: Router,
    private store: Store,
    private translate: TranslateService
  ) {
    this.initializeStoreListeners();
  }

  // ==================== INITIALIZATION ====================

  private initializeStoreListeners(): void {
    // Step değişikliklerini dinle
    this.store.select(selectCurrentStep)
      .pipe(
        filter(step => step !== null && step !== undefined),
        distinctUntilChanged()
      )
      .subscribe(currentStep => this.checkAndContinueTour(currentStep));

    // Packages result'ı dinle (Step 1)
    this.store.select(selectPackages)
      .pipe(
        filter(packages => packages && packages.length > 0),
        distinctUntilChanged()
      )
      .subscribe(() => this.handlePackagesResult());

    // Order result'ı dinle (Step 2)
    this.store.select(selectOrderResult)
      .pipe(
        filter(result => result && result.length > 0),
        distinctUntilChanged()
      )
      .subscribe(() => this.handleOrderResult());
  }

  // ==================== PUBLIC METHODS ====================

  isDemoCompany(companyId: string): boolean {
    return companyId === this.DEMO_COMPANY_ID;
  }

  shouldShowTour(companyId: string): boolean {
    return this.isDemoCompany(companyId) &&
           localStorage.getItem('tour_completed') !== 'true';
  }

  startTour(): void {
    this.log('Starting tour');
    localStorage.setItem('tour_active', 'true');
    localStorage.setItem('tour_current_step', '0');
    this.startStepTour(0);
  }

  resetTour(): void {
    localStorage.removeItem('tour_completed');
    this.cleanupTourState();
  }

  restartTour(): void {
    this.resetTour();
    this.startTour();
  }

  completeTour(): void {
    this.log('Completing tour');
    if (this.tour) {
      this.tour.complete();
      this.tour = null;
    }
    localStorage.setItem('tour_completed', 'true');
    this.cleanupTourState();
  }

  // ==================== PRIVATE TOUR METHODS ====================

  private startStepTour(stepNumber: number): void {
    this.log(`Starting step ${stepNumber}`);

    if (this.tour) {
      this.tour.complete();
    }

    const config = TOUR_CONFIG[`step${stepNumber}`];
    if (!config) {
      console.warn(`Tour config not found for step ${stepNumber}`);
      return;
    }

    this.tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: false },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' }
      }
    });

    config.steps.forEach(stepConfig => this.addTourStep(stepConfig, stepNumber));
    this.tour.start();
  }

  private addTourStep(config: TourStepConfig, stepNumber: number): void {
    const stepOptions: any = {
      id: config.id,
      text: this.translate.instant(config.text),
      buttons: this.createButtons(config, stepNumber)
    };

    if (config.selector) {
      stepOptions.attachTo = {
        element: config.selector,
        on: config.position || 'bottom'
      };

      if (config.waitForElement) {
        stepOptions.beforeShowPromise = () => this.waitForElement(config.selector!);
      }
    }

    if (config.onShow) {
      stepOptions.when = {
        show: () => this.executeAction(config.onShow!)
      };
    }

    this.tour!.addStep(stepOptions);
  }

  private createButtons(config: TourStepConfig, stepNumber: number): any[] {
    const buttons: any[] = [];

    if (config.showBack) {
      buttons.push({
        text: this.translate.instant('TOUR.COMMON.BACK'),
        action: () => this.tour?.back(),
        classes: 'shepherd-button-secondary'
      });
    }

    if (config.action) {
      buttons.push({
        text: this.translate.instant(config.actionText || 'TOUR.COMMON.NEXT'),
        action: () => this.executeAction(config.action!, stepNumber)
      });
    } else {
      buttons.push({
        text: this.translate.instant('TOUR.COMMON.NEXT'),
        action: () => this.tour?.next()
      });
    }

    return buttons;
  }

  // ==================== ACTIONS ====================

  private executeAction(action: string, stepNumber?: number): void {
    this.log(`Executing action: ${action}`);

    switch (action) {
      // STEP 0
      case 'clickManualEntry':
        this.clickAndNext('#tour-manual-entry', 800);
        break;

      case 'clickAddButton':
        this.clickAndNext('#tour-table-add-button', 500);
        break;

      case 'fillOrderDialog':
        this.fillOrderDialog();
        break;

      case 'completeStep0':
        this.completeStep(1);
        break;

      // STEP 1
      case 'clickCalculate':
        this.clickElement('.calculate-button');
        localStorage.setItem('tour_waiting_for_calculate', 'true');
        this.tour?.complete();
        break;

      case 'clickParamsButton':
        this.clickAndNext('.params-button', 500);
        break;

      case 'closeParamsDialog':
        this.clickAndNext('.close-button', 500);
        break;

      case 'completeStep1':
        this.completeStep(2);
        break;

      // STEP 2
      case 'clickOptimize':
        this.clickElement('#optimize-button');
        localStorage.setItem('tour_waiting_for_order_result', 'true');
        this.tour?.complete();
        break;

      case 'completeStep2':
        this.completeTour();
        break;

      default:
        this.tour?.next();
    }
  }

  // ==================== DIALOG FILLING ====================

  private fillOrderDialog(): void {
    this.log('Filling order dialog');

    setTimeout(() => {
      const searchInput = this.getElement<HTMLInputElement>('#tour-product-search-input');
      if (!searchInput) {
        this.warn('Product search input not found');
        return;
      }

      this.log('Search input found');
      searchInput.focus();

      setTimeout(() => {
        this.fillInput(searchInput, '22.C.500.1000');

        setTimeout(() => {
          this.waitForAutocompleteAndSelect(() => {
            const quantityInput = this.getElement<HTMLInputElement>('#tour-quantity-input');
            if (!quantityInput) {
              this.warn('Quantity input not found');
              return;
            }

            this.fillInput(quantityInput, '205');

            setTimeout(() => {
              const submitBtn = this.getElement<HTMLButtonElement>('#tour-dialog-submit-button');
              if (submitBtn && !submitBtn.disabled) {
                this.log('Clicking submit button');
                submitBtn.click();

                setTimeout(() => {
                  this.waitForElement('#tour-order-summary', 10000).then(() => {
                    this.log('Order summary ready');
                    this.tour?.next();
                  });
                }, 1500);
              } else {
                this.warn('Submit button disabled or not found');
              }
            }, 1000);
          });
        }, 1500);
      }, 500);
    }, 800);
  }

  private waitForAutocompleteAndSelect(callback: () => void): void {
    let attempts = 0;
    const maxAttempts = 25;

    const interval = setInterval(() => {
      attempts++;
      const firstOption = document.querySelector('.mat-mdc-autocomplete-panel mat-option');

      if (firstOption) {
        clearInterval(interval);
        this.log('Autocomplete option found');
        (firstOption as HTMLElement).click();
        setTimeout(callback, 800);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        this.warn('Autocomplete timeout');
      }
    }, 200);
  }

  // ==================== STORE RESULT HANDLERS ====================

  private handlePackagesResult(): void {
    const waiting = localStorage.getItem('tour_waiting_for_calculate') === 'true';
    if (waiting) {
      this.log('Packages result received, continuing tour');
      localStorage.removeItem('tour_waiting_for_calculate');
      setTimeout(() => this.continueStepTourAfterAction('step1AfterCalculate', 1), 1000);
    }
  }

  private handleOrderResult(): void {
    const waiting = localStorage.getItem('tour_waiting_for_order_result') === 'true';
    if (waiting) {
      this.log('Order result received, continuing tour');
      localStorage.removeItem('tour_waiting_for_order_result');
      setTimeout(() => this.continueStepTourAfterAction('step2AfterOptimize', 2), 1000);
    }
  }

  private continueStepTourAfterAction(configKey: string, stepNumber: number): void {
    this.log(`Continuing ${configKey}`);

    if (this.tour) {
      this.tour.complete();
    }

    this.tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: { enabled: false },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' }
      }
    });

    const config = TOUR_CONFIG[configKey];
    if (config) {
      config.steps.forEach(stepConfig => this.addTourStep(stepConfig, stepNumber));
      this.tour.start();
    }
  }

  // ==================== STEP CONTINUATION ====================

  private checkAndContinueTour(currentStep: number): void {
    const tourActive = localStorage.getItem('tour_active') === 'true';
    const shouldContinue = localStorage.getItem('tour_continue') === 'true';
    const lastTourStep = parseInt(localStorage.getItem('tour_current_step') || '0', 10);

    if (!tourActive || !shouldContinue) {
      return;
    }

    if (currentStep === lastTourStep + 1 || currentStep === lastTourStep) {
      this.log(`Step changed to ${currentStep}, continuing tour`);
      setTimeout(() => {
        localStorage.removeItem('tour_continue');
        this.startStepTour(currentStep);
      }, 1000);
    }
  }

  // ==================== HELPER METHODS ====================

  private completeStep(nextStep: number): void {
    localStorage.setItem('tour_current_step', nextStep.toString());
    localStorage.setItem('tour_continue', 'true');
    this.tour?.complete();
  }

  private clickAndNext(selector: string, delay: number): void {
    this.clickElement(selector);
    setTimeout(() => this.tour?.next(), delay);
  }

  private clickElement(selector: string): void {
    const element = this.getElement<HTMLElement>(selector);
    if (element) {
      element.click();
    } else {
      this.warn(`Element not found: ${selector}`);
    }
  }

  private fillInput(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private getElement<T extends HTMLElement>(selector: string): T | null {
    return document.querySelector(selector) as T | null;
  }

  private waitForElement(selector: string, timeout = 5000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const interval = setInterval(() => {
        const element = document.querySelector(selector);

        if (element) {
          clearInterval(interval);
          this.log(`Element found: ${selector}`);
          resolve();
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          this.warn(`Element not found after ${timeout}ms: ${selector}`);
          resolve();
        }
      }, 100);
    });
  }

  private cleanupTourState(): void {
    localStorage.removeItem('tour_active');
    localStorage.removeItem('tour_current_step');
    localStorage.removeItem('tour_continue');
    localStorage.removeItem('tour_waiting_for_calculate');
    localStorage.removeItem('tour_waiting_for_order_result');
  }

  // ==================== LOGGING ====================

  private log(message: string): void {
    if (this.DEBUG) {
      console.log(`✅ [TOUR] ${message}`);
    }
  }

  private warn(message: string): void {
    if (this.DEBUG) {
      console.warn(`⚠️ [TOUR] ${message}`);
    }
  }
}
