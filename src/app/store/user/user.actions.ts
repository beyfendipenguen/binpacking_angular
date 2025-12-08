import { createAction, props } from '@ngrx/store';
import { ChangePasswordRequest, User } from '../../core/interfaces/user.interface';

// Load User
export const loadUser = createAction(
  '[User] Load User',
  props<{ redirectUrl?: string, forceRefresh?: boolean }>()
);

export const loadUserSuccess = createAction(
  '[User] Load User Success',
  props<{ user: User; redirectUrl?: string }>()
);

export const loadUserFailure = createAction(
  '[User] Load User Failure',
  props<{ error: string }>()
);

export const loadUserFromStorage = createAction(
  '[User] Load User From Storage'
);

// Update Profile
export const updateProfile = createAction(
  '[User] Update Profile',
  props<{ profileData: Partial<User> }>()
);

export const updateProfileSuccess = createAction(
  '[User] Update Profile Success',
  props<{ user: User }>()
);

export const updateProfileFailure = createAction(
  '[User] Update Profile Failure',
  props<{ error: string }>()
);

// Update Profile Picture
export const updateProfilePicture = createAction(
  '[User] Update Profile Picture',
  props<{ file: File }>()
);

export const updateProfilePictureSuccess = createAction(
  '[User] Update Profile Picture Success',
  props<{ user: User }>()
);

export const updateProfilePictureFailure = createAction(
  '[User] Update Profile Picture Failure',
  props<{ error: string }>()
);

// Change Password
export const changePassword = createAction(
  '[User] Change Password',
  props<{ passwords: ChangePasswordRequest }>()
);
export const changePasswordSuccess = createAction(
  '[User] Change Password Success'
);
export const changePasswordFailure = createAction(
  '[User] Change Password Failure',
  props<{ error: string }>()
);

// Clear User (logout)
export const clearUser = createAction('[User] Clear User');
