import { createReducer } from '@ngrx/store';
import { initialStepperState } from './stepper.state';

// Import all reducer handlers
import { stepperOrderHandlers } from './reducers/stepper-order.reducer';
import { stepperPackageHandlers } from './reducers/stepper-package.reducer';
import { stepperResultHandlers } from './reducers/stepper-result.reducer';
import { stepperUiHandlers } from './reducers/stepper-ui.reducer';

/**
 * Ana Stepper Reducer
 *
 * Bu reducer tüm handler'ları birleştirir:
 * - stepperOrderHandlers: Order ve OrderDetail işlemleri
 * - stepperPackageHandlers: Package, Pallet ve Product işlemleri
 * - stepperResultHandlers: Result step işlemleri
 * - stepperUiHandlers: UI, navigation ve genel işlemler
 */
export const stepperReducer = createReducer(
  initialStepperState,

  // Order Handlers
  ...stepperOrderHandlers,

  // Package Handlers
  ...stepperPackageHandlers,

  // Result Handlers
  ...stepperResultHandlers,

  // UI Handlers
  ...stepperUiHandlers
);
