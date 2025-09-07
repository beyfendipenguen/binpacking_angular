import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './services/auth.service';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    const token = this.authService.getAccessToken();

    if (!token) {
      return this.redirectToLogin(state.url);
    }

    const decodedToken = this.decodeToken(token);

    if (!decodedToken || this.isTokenExpired(decodedToken.exp)) {
      // Token expired or invalid, try to refresh
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
    return (exp * 1000) < Date.now();
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
