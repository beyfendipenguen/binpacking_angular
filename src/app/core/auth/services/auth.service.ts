import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState, loadUser, StepperUiActions } from '../../../store';
import { User } from '@app/core/interfaces/user.interface';
import { TranslateService } from '@ngx-translate/core';
import { TourService } from '@app/features/services/tour.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  currentUser: User | null = null;
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);
  private store = inject(Store<AppState>);
  private translate = inject(TranslateService);

  constructor(
    private http: HttpClient,
    private router: Router,
    private tourService: TourService
  ) { }

  // Sign-up
  signUp(user: User): Observable<any> {
    const api = `${this.apiService.getApiUrl()}/register-user`;
    return this.http
      .post(api, user, { headers: this.headers })
      .pipe(catchError(this.handleError));
  }

  signIn(user: User): void {
    this.http
      .post<{ access: string; refresh: string }>(
        `${this.apiService.getApiUrl()}/token/`,
        user
      )
      .subscribe({
        next: (res) => {
          localStorage.setItem('access_token', res.access);
          localStorage.setItem('refresh_token', res.refresh);

          const redirectUrlAfterLogin =
            localStorage.getItem('redirectUrlAfterLogin') || '/';
          localStorage.removeItem('redirectUrlAfterLogin');

          this.toastService.success(this.translate.instant('AUTH.LOGIN_SUCCESS'));

          this.store.dispatch(loadUser({ redirectUrl: redirectUrlAfterLogin }));

          // 👇 Login başarılı, user yüklendikten sonra tour kontrolü yapılacak
          // Bu flag'i set ediyoruz, auth effect'te kontrol edeceğiz
          localStorage.setItem('pending_tour_check', 'true');
        },
        error: (err) => {
          this.handleError(err);
          this.toastService.error(this.translate.instant('AUTH.LOGIN_ERROR'));
        },
      });
  }

  checkAndStartTour(user: User): void {
    // 1. User var mı?
    if (!user || !user.id) {
      return;
    }

    // 2. Pending tour check var mı?
    const shouldCheck = localStorage.getItem('pending_tour_check') === 'true';

    if (shouldCheck) {
      localStorage.removeItem('pending_tour_check');

      // 3. Demo kullanıcı mı ve tour tamamlanmamış mı?
      if (this.tourService.shouldShowTour(user.company.id)) {
        // 4. Root URL'de miyiz? (Login page'de değiliz)
        if (this.router.url === '/' || this.router.url.startsWith('/')) {
          setTimeout(() => {
            this.tourService.startTour();
          }, 1500);
        }
      }
    }
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  refreshAccessToken$(): Observable<{ access: string; refresh: string }> {
    const refresh_token = localStorage.getItem('refresh_token');
    return this.http.post<{ access: string; refresh: string }>(
      `${this.apiService.getApiUrl()}/token/refresh/`,
      { refresh: refresh_token }
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  doLogout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('redirectUrlAfterLogin');
    localStorage.removeItem('invoice_reference_data');
    localStorage.removeItem('enhanced_stepper_draft_data');
    localStorage.removeItem('user');
    localStorage.removeItem('pending_tour_check'); // 👈 YENİ: Logout'ta temizle
    this.store.dispatch(StepperUiActions.resetStepper());
    this.router.navigate(['/auth/login']);
  }

  clearLocalAndStore(): void {
    localStorage.removeItem('invoice_reference_data');
    localStorage.removeItem('enhanced_stepper_draft_data');
    this.store.dispatch(StepperUiActions.resetStepper());
    this.router.navigate(['/']);
  }

  clearLocalAndStoreForEditMode(): void {
    localStorage.removeItem('invoice_reference_data');
    localStorage.removeItem('enhanced_stepper_draft_data');
    this.store.dispatch(StepperUiActions.resetStepperForEditMode());
  }

  // Error handling
  private handleError(error: HttpErrorResponse): Observable<never> {
    let msg =
      error.error instanceof ErrorEvent
        ? error.error.message
        : `Error Code: ${error.status}\nMessage: ${error.message}`;

    return throwError(() => msg);
  }
}
