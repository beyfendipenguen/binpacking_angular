import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

export const stepperResultHandlers = [

  // Load Order Result Success (Edit Mode)
  on(StepperResultActions.loadOrderResultSuccess, (state: StepperState, { orderResult, reportFiles }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: [...orderResult],
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

  on(StepperResultActions.placePackageInTruck, (state: StepperState, { pkgId, x, y, z }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: state.step3State.orderResult.map(pos =>
        pos[8] === pkgId
          ? [x, y, z, pos[3], pos[4], pos[5], pos[6], pos[7], pkgId] as PackagePosition
          : pos
      )
    }
  })),

  on(StepperResultActions.removePackageFromTruck, (state: StepperState, { pkgId }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: state.step3State.orderResult.map(pos =>
        pos[8] === pkgId
          ? [-1, -1, -1, pos[3], pos[4], pos[5], pos[6], pos[7], pkgId] as PackagePosition
          : pos
      )
    }
  })),

  // Add Deleted Package Id List
  on(StepperResultActions.changeDeletedPackageIsRemaining, (state: StepperState) => {
    // orderResult'tan hangi pkgId'lerin -1,-1,-1 olduğunu bul
    const deletedPkgIds = new Set(
      state.step3State.orderResult
        .filter(pos => pos[0] === -1 && pos[1] === -1 && pos[2] === -1)
        .map(pos => pos[8]) // pkgId index 8'de
    );

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: state.step2State.packages.map(pkg => ({
          ...pkg,
          is_remaining: !deletedPkgIds.has(pkg.id) // -1 ise true, değilse false
        }))
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
      orderResult: [],
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
