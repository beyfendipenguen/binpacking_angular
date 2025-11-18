import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './services/auth.service';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const accessToken = this.authService.getAccessToken();
    const refreshToken = localStorage.getItem('refresh_token');

    if (!accessToken || !refreshToken) {
      return this.redirectToLogin(state.url);
    }

    const decodedAccessToken = this.decodeToken(accessToken);

    if (!decodedAccessToken || this.isTokenExpired(decodedAccessToken.exp)) {
      const decodedRefreshToken = this.decodeToken(refreshToken);

      if (
        !decodedRefreshToken ||
        this.isTokenExpired(decodedRefreshToken.exp)
      ) {
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('access_token');
        return this.redirectToLogin(state.url);
      }

      return this.authService.refreshAccessToken$().pipe(
        map((res) => {
          localStorage.setItem('access_token', res.access);
          localStorage.setItem('refresh_token', res.refresh);
          return true;
        }),
        catchError((err) => {
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('access_token');
          return this.redirectToLogin(state.url);
        })
      );
    }

    // Token is valid
    return of(true);
  }

  private redirectToLogin(currentUrl: string): Observable<boolean> {
    localStorage.setItem('redirectUrlAfterLogin', currentUrl);
    this.router.navigate(['/auth/login']);
    return of(false);
  }

  private isTokenExpired(exp: number): boolean {
    return exp * 1000 < Date.now() + 30000;
  }

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (error) {
      return null;
    }
  }
}
