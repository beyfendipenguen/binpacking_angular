import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Injectable({ providedIn: 'root' })
export class LoginGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const token = this.authService.getAccessToken();

    if (token) {
      const decodedToken = this.decodeToken(token);

      if (decodedToken && !this.isTokenExpired(decodedToken.exp)) {
        this.router.navigate(['/']);
        return false;
      }
    }

    return true;
  }

  private isTokenExpired(exp: number): boolean {
    return exp * 1000 < Date.now();
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
