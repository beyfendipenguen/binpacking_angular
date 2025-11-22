import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperUiActions } from '../actions/stepper-ui.actions';

export const stepperUiHandlers = [

  // Init
  on(StepperUiActions.init, (state: StepperState) => ({
    ...state,
    // ...MEVCUT LOGIC'İ BURAYA YAPIŞTIR
  })),

  // Reset
  on(StepperUiActions.resetStepper, (state: StepperState) => ({
    ...state
  })),

  // Step Navigation
  on(StepperUiActions.setStepCompleted, (state: StepperState, { stepIndex }) => ({
    ...state,
    completedStep: Math.max(state.completedStep, stepIndex)
    // ...MEVCUT LOGIC'İ BURAYA YAPIŞTIR
  })),

  on(StepperUiActions.setActiveStep, (state: StepperState, { stepIndex }) => ({
    ...state,
    currentStep: stepIndex
  })),

  // Error & Loading
  on(StepperUiActions.setGlobalError, (state: StepperState, { error }) => ({
    ...state,
    globalError: {
      ...error,
      timestamp: new Date()
    },
    loading: false
  })),

  // LocalStorage Restore
  on(StepperUiActions.restoreLocalStorageData, (state: StepperState) => ({
      ...state
      // ...Logic
  })),

  on(StepperUiActions.setStepperData, (state: StepperState, { data }) => ({
    ...state,
    ...data
  })),

  on(StepperUiActions.setTemplateFile, (state: StepperState, { file }) => ({
    ...state,
    step1State: {
        ...state.step1State,
        templateFile: file
    }
  }))
];
