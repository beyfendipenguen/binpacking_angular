import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { mapUiPackagesToOrderDetails } from '@features/mappers/ui-package-to-order-detail.mapper';
import { OrderDetailDiffCalculator } from '@features/utils/order-detail-diff.util';

// Helper function
const ensureEmptyPackageAdded = (packages: any[], order: any): any => {
  const emptyPackage = {
    id: crypto.randomUUID(),
    pallet: null,
    products: [],
    order: order,
    name: `${packages.length + 1}`,
    isSavedInDb: false,
  };

  if (packages.some(pkg => pkg.pallet === null || pkg.products.length === 0))
    return ensurePackagesNamesOrdered(packages);
  return ensurePackagesNamesOrdered([...packages, emptyPackage]);
};

const ensurePackagesNamesOrdered = (packages: any[]) => {
  return packages.map((pkg, index) => ({ ...pkg, name: `${index + 1}` }));
};

export const stepperResultHandlers = [
  // Complete Shipment
  on(StepperResultActions.completeShipment, (state: StepperState, { orderResult }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: orderResult
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

  on(StepperResultActions.addDeletedPackageIdList, (state: StepperState, { packageIds }) => {
    const packageIdSet = new Set(packageIds);

    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: state.step2State.packages.map(pkg => ({
          ...pkg,
          is_remaining: !packageIdSet.has(pkg.id)
        }))
      },
      step3State: {
        ...state.step3State,
        deletedPackageIds: [...packageIds]
      }
    };
  }),
  // Set Is Dirty
  on(StepperResultActions.setIsDirty, (state: StepperState, { isDirty }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      isDirty: isDirty
    }
  })),


  // Result Step Submit
  on(StepperResultActions.resultStepSubmit, (state: StepperState, { orderResult }) => {
    return {
      ...state,
      step3State: {
        ...state.step3State,
        orderResult: orderResult,
        hasResults: true,
      }
    };
  }),

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

  on(StepperResultActions.setOrderResultId,(state: StepperState, { orderResultId })=>({
    ...state,
    orderResultId: orderResultId
  }))
];
