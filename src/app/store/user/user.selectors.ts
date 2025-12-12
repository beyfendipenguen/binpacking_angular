import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState } from './user.state';
import { User } from '@app/core/interfaces/user.interface';

export const selectUserState = createFeatureSelector<UserState>('user');

export const selectUser = createSelector(
  selectUserState,
  (state: UserState) => state.user
);

export const selectUserPermissions = createSelector(
  selectUser,
  (user: User | null) => user?.permissions
)

export const selectUserLoading = createSelector(
  selectUserState,
  (state: UserState) => state.loading
);

export const selectUserError = createSelector(
  selectUserState,
  (state: UserState) => state.error
);

export const selectIsLoggedIn = createSelector(
  selectUser,
  (user) => !!user
);
