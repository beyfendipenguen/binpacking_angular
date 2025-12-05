import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const StepperResultActions = createActionGroup({
  source: 'Stepper Result',
  events: {
    // Submit
    'Result Step Submit': props<{ orderId: string, orderResult: string, resetStepper: boolean, packageNames?: string[] }>(),
    'Result Step Submit Success': emptyProps(),
    'Result Step Submit Error': props<{ error: string }>(),

    // Güncelleme
    'Update Order Result': emptyProps(),

    // Rapor
    'Create Report File': props<{ orderId: string }>(),
    'Create Report File Success': props<{ reportFiles: any[] }>(),

    // Tamamlama
    'Complete Shipment': props<{ orderResult: string }>(),

    //SetOrderResultId
    'Set Order Result Id': props<{ orderResultId: string }>(),

    //Delete Package
    'Add Deleted Package Id List': props<{packageIds:string[]}>(),

  }
});
