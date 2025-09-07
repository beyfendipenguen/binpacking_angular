import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { catchError, Observable, take, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { Store } from '@ngrx/store';
import { AppState, loadUser, loadUserSuccess } from '../../store';
import { Actions, ofType } from '@ngrx/effects';
import { resetStepper } from '../../store';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  //https://dev.to/cotter/localstorage-vs-cookies-all-you-need-to-know-about-storing-jwt-tokens-securely-in-the-front-end-15id
  // TODO: gecici olarak localstorage kullan
  // daha sonra csrf token ile cookie kullan

  private headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  currentUser: User | null = null;
  private apiService = inject(ApiService);
  private toastService = inject(ToastService)
  private store = inject(Store<AppState>)
  constructor(private http: HttpClient, private router: Router,private actions$: Actions,) { }

  // Sign-up
  signUp(user: User): Observable<any> {
    const api = `${this.apiService.getApiUrl()}/register-user`;
    return this.http.post(api, user, { headers: this.headers }).pipe(
      catchError(this.handleError)
    );
  }

  // Sign-in
  signIn(user: User): void {
    this.http.post<{ access: string, refresh: string }>(`${this.apiService.getApiUrl()}/token/`, user).subscribe({
      next: (res) => {
        localStorage.setItem('access_token', res.access);
        localStorage.setItem('refresh_token', res.refresh);
        this.store.dispatch(loadUser());
        this.actions$.pipe(
        ofType(loadUserSuccess),
        take(1) // Sadece bir kez dinle
        ).subscribe(() => {
          const redirectUrlAfterLogin = localStorage.getItem('redirectUrlAfterLogin');
          this.toastService.success("Giriş Başarılı", "Başarılı");

          if (redirectUrlAfterLogin) {
            localStorage.removeItem('redirectUrlAfterLogin');
            this.router.navigate([redirectUrlAfterLogin]);
          } else {
            this.router.navigate(['/']);
          }
        });
      },
      error: (err) => {
        this.handleError
        this.toastService.error("Kullanıcı adı veya parola yanlış","Hata")
      }
    });
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  refreshAccessToken$(): Observable<{ access: string, refresh: string }> {
    const refresh_token = localStorage.getItem('refresh_token');
    return this.http.post<{ access: string, refresh: string }>(`${this.apiService.getApiUrl()}/token/refresh/`, { refresh: refresh_token });
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  doLogout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('redirectUrlAfterLogin')
    localStorage.removeItem('invoice_reference_data')
    localStorage.removeItem('enhanced_stepper_draft_data')
    localStorage.removeItem('user')
    this.store.dispatch(resetStepper());
    this.router.navigate(['/auth/login']);
  }

  // Error handling
  private handleError(error: HttpErrorResponse): Observable<never> {
    let msg = error.error instanceof ErrorEvent
      ? error.error.message
      : `Error Code: ${error.status}\nMessage: ${error.message}`;

    return throwError(() => msg);
  }
}
