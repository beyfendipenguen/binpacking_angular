import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const StepperResultActions = createActionGroup({
  source: 'Stepper Result',
  events: {
    // Submit
    'Result Step Submit': props<{ resetStepper: boolean }>(),
    'Result Step Submit Success': emptyProps(),

    // Güncelleme
    'Update Order Result': emptyProps(),

    // Rapor
    'Create Report File': emptyProps(),
    'Create Report File Success': props<{ reportFiles: any[] }>(),

    // Tamamlama
    'Complete Shipment': emptyProps()
  }
});
