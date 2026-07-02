import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ReportFile } from '@app/features/stepper/components/result-step/result-step.service';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

export const StepperResultActions = createActionGroup({
  source: 'Stepper Result',
  events: {
    // Edit Mode - Data Loading
    'Load Order Result Success': props<{
      orderResult: PackagePosition[];
      reportFiles: ReportFile[];
      shipments?: PackagePosition[][];
      isMultiShipment?: boolean;
      deletedPackages?: PackagePosition[];
    }>(),
    'Set Order Result': props<{ orderResult: PackagePosition[] }>(),

    // Submit
    'Result Step Submit': props<{
      orderId: string;
      orderResult: { shipments: { shipment: number; result: PackagePosition[] }[] };
      resetStepper: boolean;
    }>(),
    'Result Step Submit Success': emptyProps(),
    'Result Step Submit Error': props<{ error: string }>(),

    // Shipment navigation
    'Set Active Shipment': props<{ index: number }>(),

    // Rapor
    'Create Report File': props<{ orderId: string }>(),
    'Create Report File Success': props<{ reportFiles: ReportFile[] }>(),

    // Three.js State Updates
    'Set Current View Type': props<{ viewType: string }>(),
    'Set Three JS Error': props<{ hasError: boolean }>(),

    'Set Order Result Id': props<{ orderResultId: string }>(),

    // Package placement (aktif shipment'ın orderResult'unu, dolayısıyla
    // shipments[activeIndex]'i de senkron günceller — bkz. reducer)
    'Place Package In Truck': props<{ pkgId: string; x: number; y: number; z: number }>(),
    'Add Package To Truck': props<{ position: PackagePosition }>(),
    'Remove Package From Truck': props<{ pkgId: string }>(),

    // Deleted packages — global havuz
    'Set Deleted Packages': props<{ deletedPackages: PackagePosition[] }>(),
    'Add Deleted Package': props<{ row: PackagePosition }>(),
    'Remove Deleted Package': props<{ pkgId: string }>(),

    // step2State.packages[].is_remaining senkronizasyonu
    'Sync Remaining Packages': props<{ deletedPkgIds: string[] }>(),

    'Set Is Dirty': props<{ isDirty: boolean }>(),

    // Reset Step3
    'Reset Step3 State': emptyProps(),

    'Apply Backend Sync': props<{
      deletedPackages: PackagePosition[];
      removedPkgIds: string[];   // kamyondan (orderResult + shipments) çıkarılacaklar
    }>(),
  }
});