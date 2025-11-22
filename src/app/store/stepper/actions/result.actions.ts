import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const ResultActions = createActionGroup({
  source: 'Result Step',
  events: {
    // Submit İşlemi
    'Result Step Submit': props<{ resetStepper: boolean }>(),
    'Result Step Submit Success': emptyProps(),

    // Raporlama
    'Create Report File': emptyProps(),
    'Create Report File Success': props<{ reportFiles: any[] }>(),

    // Sonuç Güncelleme / Tamamlama
    'Update Order Result': emptyProps(),
    'Complete Shipment': emptyProps(),
  }
});
