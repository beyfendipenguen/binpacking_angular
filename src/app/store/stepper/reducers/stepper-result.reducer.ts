import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperResultActions } from '../actions/stepper-result.actions';

export const stepperResultHandlers = [

  // Load Order Result Success (Edit Mode)
  on(StepperResultActions.loadOrderResultSuccess, (state: StepperState, { orderResult, reportFiles }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: orderResult,
      reportFiles: reportFiles,
      isDirty: false
    }
  })),

  on(StepperResultActions.setOrderResult, (state: StepperState, { orderResult }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: orderResult,
    }
  })),

  // Create Report File Success
  on(StepperResultActions.createReportFileSuccess, (state: StepperState, { reportFiles }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      reportFiles: reportFiles,
      isDirty: false
    }
  })),

  // Set Current View Type
  on(StepperResultActions.setCurrentViewType, (state: StepperState, { viewType }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      currentViewType: viewType
    }
  })),

  // Add Deleted Package Id List
  on(StepperResultActions.changeDeletedPackageIsRemaining, (state: StepperState, { packageIds }) => {
    // Gelen array'i performans için Set'e çeviriyoruz (araması daha hızlıdır)
    // Güvenlik: packageIds null/undefined gelirse diye boş dizi önlemi
    const idsToToggle = new Set(packageIds || []);

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: state.step2State.packages.map(pkg => {
          // Eğer bu paketin ID'si, gelen listenin içindeyse:
          if (idsToToggle.has(pkg.id)) {
            return {
              ...pkg,
              is_remaining: !pkg.is_remaining // MEVCUT DEĞERİ TERSİNE ÇEVİR (Toggle)
            };
          }

          // Listede yoksa paketi olduğu gibi bırak
          return pkg;
        })
      }
    };
  }),

  // Clear Deleted Packages
  on(StepperResultActions.clearDeletedPackages, (state: StepperState) => ({
    ...state,
    step3State: {
      ...state.step3State,
      deletedPackageIds: []
    }
  })),

  // Set Is Dirty
  on(StepperResultActions.setIsDirty, (state: StepperState, { isDirty }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      isDirty: isDirty
    }
  })),

  // Result Step Submit
  on(StepperResultActions.resultStepSubmit, (state: StepperState, { orderResult }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: orderResult
    }
  })),

  // Result Step Submit Success
  on(StepperResultActions.resultStepSubmitSuccess, (state: StepperState) => ({
    ...state,
    step3State: {
      ...state.step3State,
      isDirty: false
    }
  })),

  // Result Step Submit Error
  on(StepperResultActions.resultStepSubmitError, (state: StepperState, { error }) => ({
    ...state,
    globalError: {
      message: error,
      stepIndex: 3,
      timestamp: new Date()
    }
  })),

  // Reset Step3 State
  on(StepperResultActions.resetStep3State, (state: StepperState) => ({
    ...state,
    step3State: {
      orderResult: '',
      reportFiles: [],
      currentViewType: 'isometric',
      hasThreeJSError: false,
      deletedPackages: [],
      processedPackages: [],
      isDirty: false
    }
  })),

  on(StepperResultActions.setOrderResultId, (state: StepperState, { orderResultId }) => ({
    ...state,
    orderResultId: orderResultId
  }))
];
