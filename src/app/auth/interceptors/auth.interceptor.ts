import { inject } from '@angular/core';
import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { throwError, switchMap, catchError, from } from 'rxjs';

export const AuthInterceptor = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);

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
        // 401 → access token süresi dolmuş
        return authService.refreshAccessToken$().pipe(
          switchMap((res) => {
            // Yeni token'ları sakla
            localStorage.setItem('access_token', res.access);
            localStorage.setItem('refresh_token', res.refresh);

            // Orijinal isteği yeni token ile tekrar gönder
            const retryReq = req.clone({
              setHeaders: {
                Authorization: 'Bearer ' + res.access,
              },
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => {
            // Refresh token geçersiz ise logout yap
            authService.doLogout();
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
