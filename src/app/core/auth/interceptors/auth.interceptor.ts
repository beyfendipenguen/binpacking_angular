import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { throwError, switchMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Store } from '@ngrx/store';
import { loadUser } from '@app/store';

export const AuthInterceptor = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const store = inject(Store);


  const token = authService.getAccessToken();
  const authReq = req.clone({
    withCredentials: true,
    setHeaders: {
      Authorization: token ? 'Bearer ' + token : '',
    },
  });

  return next(authReq).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        if (req.url.includes('/token/refresh/')) {
          authService.doLogout();
          return throwError(() => err);
        }

        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          authService.doLogout();
          return throwError(() => err);
        }

        try {
          const payload = refreshToken.split('.')[1];
          const decoded = JSON.parse(atob(payload));

          if (decoded.exp * 1000 < Date.now()) {
            authService.doLogout();
            return throwError(() => err);
          }
        } catch (error) {
          authService.doLogout();
          return throwError(() => err);
        }

        return authService.refreshAccessToken$().pipe(
          switchMap((res) => {
            localStorage.setItem('access_token', res.access);
            localStorage.setItem('refresh_token', res.refresh);

            const retryReq = req.clone({
              setHeaders: {
                Authorization: 'Bearer ' + res.access,
              },
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => {
            authService.doLogout();
            return throwError(() => refreshErr);
          })
        );
      }
      if (err instanceof HttpErrorResponse && err.status === 403) {
        store.dispatch(loadUser({ forceRefresh: true }));
      }
      return throwError(() => err);
    })
  );
};
