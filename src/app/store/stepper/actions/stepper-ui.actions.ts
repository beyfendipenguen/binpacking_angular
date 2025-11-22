import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { StepperState } from '../stepper.state'; // State importunu kontrol et

export const StepperUiActions = createActionGroup({
  source: 'Stepper UI',
  events: {
    // Genel
    'Init': emptyProps(),
    'Reset Stepper': emptyProps(),

    // Step Yönetimi
    'Set Step Completed': props<{ stepIndex: number }>(),
    'Set Active Step': props<{ stepIndex: number }>(),
    'Stepper Step Updated': emptyProps(), // Auto-save tetikleyici

    // Hata Yönetimi
    'Set Global Error': props<{ error: { message: string; stepIndex?: number } }>(),
    'Set Stepper Error': props<{ error: string }>(),

    // Local Storage / State
    'Restore Local Storage Data': emptyProps(),
    'Set Stepper Data': props<{ data: any }>(), // Şimdilik any, sonra StepperState yaparız

    // Diğer UI
    'Set Template File': props<{ file: any }>()
  }
});
