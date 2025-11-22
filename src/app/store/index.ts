import { ActionReducerMap } from '@ngrx/store';
import { StepperState } from './stepper/stepper.state';
import { stepperReducer } from './stepper/stepper.reducer';
import { userReducer } from './user/user.reducer';

// App State Interface
export interface AppState {
  stepper: StepperState;
}

// Root Reducers
export const reducers: ActionReducerMap<AppState> = {
  stepper: stepperReducer,
  user: userReducer
} as ActionReducerMap<AppState>;

// Export all selectors for easy import
export * from './stepper/stepper.selectors';
// Export Stepper Actions (4 gruba ayrıldı)
export * from './stepper/actions/stepper-order.actions';
export * from './stepper/actions/stepper-package.actions';
export * from './stepper/actions/stepper-result.actions';
export * from './stepper/actions/stepper-ui.actions';

// Export diğer action grupları (eski CRUD action'ları)
export * from './stepper/actions/order.actions';
export * from './stepper/actions/order-detail.actions';
export * from './stepper/actions/package-detail.actions';

export * from './user/user.selectors';
export * from './user/user.actions';
export type { StepperState } from './stepper/stepper.state';
export type { UserState } from './user/user.state';
