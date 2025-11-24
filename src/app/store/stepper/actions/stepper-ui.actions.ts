import { OrderDetailRead } from '@app/features/interfaces/order-detail.interface';
import { Order } from '@app/features/interfaces/order.interface';
import { Pallet } from '@app/features/interfaces/pallet.interface';
import { UiPackage } from '@app/features/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '@app/features/stepper/components/ui-models/ui-pallet.model';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const StepperUiActions = createActionGroup({
  source: 'Stepper UI',
  events: {
    // Genel

    // Edit Modu
    'Enable Edit Mode': props<{ orderId: string }>(),
    'Set Edit Mode Stepper Data':props<{order:Order, orderDetails:OrderDetailRead[], pallets:UiPallet[], packages:UiPackage[]}>(), //Daha kullanilmiyor

    'Init': emptyProps(),
    'Initialize Stepper': props<{ editMode?: boolean; editOrderId?: string }>(),
    'Reset Stepper': emptyProps(),

    // Step Yönetimi
    'Navigate To Step': props<{ stepIndex: number }>(),
    'Set Step Completed': props<{ stepIndex: number }>(),
    'Set Step Validation': props<{ stepIndex: number; isValid: boolean }>(),
    'Set Active Step': props<{ stepIndex: number }>(),
    'Stepper Step Updated': emptyProps(), // Auto-save tetikleyici

    // Hata Yönetimi
    'Set Global Error': props<{ error: { message: string; code?: string; stepIndex?: number } }>(),
    'Set Stepper Error': props<{ error: string | null }>(),

    // Local Storage / State
    'Restore Local Storage Data': emptyProps(),
    'Set Stepper Data': props<{ data: any }>(),

    // Dirty Flags
    'Set Step1 Is Dirty': emptyProps(),
    'Set Step2 Is Dirty': emptyProps(),
    'Set Step3 Is Dirty': emptyProps()
  }
});
