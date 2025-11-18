import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { UserService } from '../../services/user.service';
import * as UserActions from './user.actions';
import { filter } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class UserEffects {
  private actions$ = inject(Actions);
  private userService = inject(UserService);
  private router = inject(Router);

  loadUserFromStorage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUserFromStorage),
      map(() => localStorage.getItem('user')),
      filter((user) => !!user),
      map((user) => UserActions.loadUserSuccess({ user: JSON.parse(user!) }))
    )
  );

  loadUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUser),
      switchMap(({ redirectUrl }) => {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            return of(UserActions.loadUserSuccess({ user, redirectUrl }));
          } catch (error) {
            localStorage.removeItem('user');
          }
        }

        const token = localStorage.getItem('access_token');
        if (!token) {
          return of(UserActions.loadUserFailure({ error: 'No access token' }));
        }

        return this.userService.getProfile().pipe(
          map((user) => {
            return UserActions.loadUserSuccess({ user, redirectUrl });
          }),
          catchError((error) => {
            return of(UserActions.loadUserFailure({ error: error.message }));
          })
        );
      })
    )
  );

  loadUserSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UserActions.loadUserSuccess),
        tap(({ redirectUrl }) => {
          if (redirectUrl) {
            this.router.navigate([redirectUrl]);
          }
        })
      ),
    { dispatch: false }
  );

  updateProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.updateProfile),
      switchMap(({ profileData }) =>
        this.userService.updateProfile(profileData).pipe(
          map((user) => UserActions.updateProfileSuccess({ user })),
          catchError((error) =>
            of(UserActions.updateProfileFailure({ error: error.message }))
          )
        )
      )
    )
  );

  updateProfilePicture$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.updateProfilePicture),
      switchMap(({ file }) =>
        this.userService.updateProfilePicture(file).pipe(
          map((user) => UserActions.updateProfilePictureSuccess({ user })),
          catchError((error) =>
            of(
              UserActions.updateProfilePictureFailure({ error: error.message })
            )
          )
        )
      )
    )
  );

  changePassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.changePassword),
      switchMap(({ passwords }) =>
        this.userService.changePassword(passwords).pipe(
          map(() => UserActions.changePasswordSuccess()),
          catchError((error) =>
            of(UserActions.changePasswordFailure({ error: error.message }))
          )
        )
      )
    )
  );

  saveUserToStorage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          UserActions.loadUserSuccess,
          UserActions.updateProfileSuccess,
          UserActions.updateProfilePictureSuccess
        ),
        tap(({ user }) => {
          localStorage.setItem('user', JSON.stringify(user));
        })
      ),
    { dispatch: false }
  );

  clearUserFromStorage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(UserActions.clearUser),
        tap(() => {
          localStorage.removeItem('user');
        })
      ),
    { dispatch: false }
  );
}
