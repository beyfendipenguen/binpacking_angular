import { on } from '@ngrx/store';
import { StepperState, initialStepperState } from '../stepper.state';
import { StepperUiActions } from '../actions/stepper-ui.actions';

export const stepperUiHandlers = [
  // Init
  on(StepperUiActions.init, (state: StepperState) => ({
    ...state,
    // Init mantığı gerekirse buraya eklenir
  })),

  // Initialize Stepper
  on(StepperUiActions.initializeStepper, (state: StepperState, { editMode, editOrderId }) => ({
    ...state,
    isEditMode: editMode || false,
    editOrderId: editOrderId || null,
    error: null
  })),

  // Reset
  on(StepperUiActions.resetStepper, () => ({
    ...initialStepperState
  })),

  // Step Navigation
  on(StepperUiActions.navigateToStep, (state: StepperState, { stepIndex }) => ({
    ...state,
    currentStep: stepIndex,
    error: null
  })),

  on(StepperUiActions.setStepCompleted, (state: StepperState, { stepIndex }) => ({
    ...state,
    completedStep: Math.max(state.completedStep, stepIndex)
  })),

  on(StepperUiActions.setActiveStep, (state: StepperState, { stepIndex }) => ({
    ...state,
    currentStep: stepIndex
  })),

  on(StepperUiActions.setStepValidation, (state: StepperState, { stepIndex, isValid }) => ({
    ...state,
    // Step validation mantığı gerekirse buraya eklenir
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

  on(StepperUiActions.setStepperError, (state: StepperState, { error }) => ({
    ...state,
    error,
    loading: false
  })),

  // LocalStorage Restore
  on(StepperUiActions.restoreLocalStorageData, (state: StepperState) => ({
    ...state
    // LocalStorage restore mantığı effect'te handle edilir
  })),

  on(StepperUiActions.setStepperData, (state: StepperState, { data }) => ({
    ...state,
    ...data
  })),

  // Dirty Flags
  on(StepperUiActions.setStep1IsDirty, (state: StepperState) => {
    // Step1 için dirty flag mantığı gerekirse buraya eklenir
    return state;
  }),

  on(StepperUiActions.setStep2IsDirty, (state: StepperState) => {
    if (state.step2State.isDirty) {
      return state;
    }
    return {
      ...state,
      step2State: {
        ...state.step2State,
        isDirty: true
      }
    };
  }),

  on(StepperUiActions.setStep3IsDirty, (state: StepperState) => {
    return {
      ...state,
      step3State: {
        ...state.step3State,
        isDirty: true
      }
    };
  }),

  // Stepper Step Updated (AutoSave trigger)
  on(StepperUiActions.stepperStepUpdated, (state: StepperState) => ({
    ...state
    // Bu action genelde effect'te handle edilir (localStorage save için)
  })),

  // Revise Order
  on(StepperUiActions.reviseOrderSuccess, (state: StepperState) => ({
    ...state,
    hasRevisedOrder: true
  }))

];
