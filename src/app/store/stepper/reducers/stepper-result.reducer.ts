import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

/**
 * Aktif shipment'ın orderResult'unu günceller VE shipments[activeIndex]'i
 * aynı veriyle senkron tutar. orderResult'ı değiştiren her reducer bunu
 * kullanmalı — aksi halde shipment'lar arası geçişte eski veri geri gelir.
 */
function syncActiveShipment(state: StepperState, newOrderResult: PackagePosition[]) {
  const idx = state.step3State.activeShipmentIndex;
  const updatedShipments = state.step3State.shipments.length > 0
    ? state.step3State.shipments.map((s, i) => i === idx ? newOrderResult : s)
    : state.step3State.shipments;
  return { orderResult: newOrderResult, shipments: updatedShipments };
}

export const stepperResultHandlers = [

  // Load Order Result Success (Edit Mode / Calculate sonrası)
  on(StepperResultActions.loadOrderResultSuccess, (state: StepperState, { orderResult, reportFiles, shipments, isMultiShipment, deletedPackages }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      orderResult: [...orderResult],
      reportFiles,
      shipments: shipments ?? [],
      isMultiShipment: isMultiShipment ?? false,
      deletedPackages: deletedPackages ?? [],
      activeShipmentIndex: 0,
      isDirty: false
    }
  })),

  on(StepperResultActions.setActiveShipment, (state: StepperState, { index }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      activeShipmentIndex: index,
      orderResult: state.step3State.shipments[index] ?? [],
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

  // ───────── Aktif shipment'ın orderResult'unu değiştiren action'lar ─────────

  on(StepperResultActions.removePackageFromTruck, (state: StepperState, { pkgId }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, state.step3State.orderResult.filter(pos => pos[8] !== pkgId))
    }
  })),

  on(StepperResultActions.addPackageToTruck, (state: StepperState, { position }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, [...state.step3State.orderResult, position])
    }
  })),

  on(StepperResultActions.placePackageInTruck, (state: StepperState, { pkgId, x, y, z }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, state.step3State.orderResult.map(pos =>
        pos[8] === pkgId
          ? [x, y, z, pos[3], pos[4], pos[5], pos[6], pos[7], pkgId] as PackagePosition
          : pos
      ))
    }
  })),

  on(StepperResultActions.setOrderResult, (state: StepperState, { orderResult }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, orderResult)
    }
  })),

  // ───────── Deleted packages — global havuz ─────────

  on(StepperResultActions.setDeletedPackages, (state: StepperState, { deletedPackages }) => ({
    ...state,
    step2State: syncStep2Remaining(state, deletedPackages),
    step3State: { ...state.step3State, deletedPackages }
  })),

  on(StepperResultActions.addDeletedPackage, (state: StepperState, { row }) => {
    const newDeleted = [...state.step3State.deletedPackages, row];
    return {
      ...state,
      step2State: syncStep2Remaining(state, newDeleted),
      step3State: { ...state.step3State, deletedPackages: newDeleted }
    };
  }),

  on(StepperResultActions.removeDeletedPackage, (state: StepperState, { pkgId }) => {
    const newDeleted = state.step3State.deletedPackages.filter(row => row[8] !== pkgId);
    return {
      ...state,
      step2State: syncStep2Remaining(state, newDeleted),
      step3State: { ...state.step3State, deletedPackages: newDeleted }
    };
  }),

  // step2State.packages[].is_remaining senkronizasyonu
  on(StepperResultActions.syncRemainingPackages, (state: StepperState, { deletedPkgIds }) => {
    const deletedSet = new Set(deletedPkgIds);
    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: state.step2State.packages.map(pkg => ({
          ...pkg,
          is_remaining: !deletedSet.has(pkg.id)
        }))
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
      timestamp: new Date().toISOString()
    }
  })),

  // Reset Step3 State
  on(StepperResultActions.resetStep3State, (state: StepperState) => ({
    ...state,
    step3State: {
      orderResult: [],
      deletedPackages: [],
      shipments: [],
      activeShipmentIndex: 0,
      isMultiShipment: false,
      reportFiles: [],
      currentViewType: 'isometric',
      hasThreeJSError: false,
      isDirty: false
    }
  })),

  on(StepperResultActions.setOrderResultId, (state: StepperState, { orderResultId }) => ({
    ...state,
    orderResultId: orderResultId
  }))
];

function syncStep2Remaining(state: StepperState, deletedPackages: PackagePosition[]) {
  const deletedSet = new Set(deletedPackages.map(row => row[8]));
  return {
    ...state.step2State,
    packages: state.step2State.packages.map(pkg => ({
      ...pkg,
      is_remaining: !deletedSet.has(pkg.id)
    }))
  };
}