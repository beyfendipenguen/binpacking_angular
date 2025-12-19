import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Document } from '@app/features/interfaces/file.interface';
import { ReportFile } from '@app/features/stepper/components/result-step/result-step.service';
import { PackageData } from '@app/features/interfaces/order-result.interface';

export const StepperResultActions = createActionGroup({
  source: 'Stepper Result',
  events: {
    // Edit Mode - Data Loading
    'Load Order Result Success': props<{ orderResult: string, reportFiles: ReportFile[] }>(),
    'Set Order Result': props<{orderResult:string}>(),

    // Submit
    'Result Step Submit': props<{ orderId: string, orderResult: string, resetStepper: boolean }>(),
    'Result Step Submit Success': emptyProps(),
    'Result Step Submit Error': props<{ error: string }>(),

    // Rapor
    'Create Report File': props<{ orderId: string }>(),
    'Create Report File Success': props<{ reportFiles: ReportFile[] }>(),

    // Three.js State Updates
    'Set Current View Type': props<{ viewType: string }>(),
    'Set Three JS Error': props<{ hasError: boolean }>(),
    //SetOrderResultId
    'Set Order Result Id': props<{ orderResultId: string }>(),
    // Delete Package
    'Change Deleted Package Is Remaining': props<{ packageIds: string[]}>(),
    'Clear Deleted Packages': emptyProps(),

    // Set is dirty
    'Set Is Dirty': props<{ isDirty: boolean }>(),

    // Reset Step3
    'Reset Step3 State': emptyProps(),
  }
});
