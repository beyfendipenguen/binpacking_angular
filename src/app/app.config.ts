import { ApplicationConfig, provideZoneChangeDetection, inject, provideAppInitializer, importProvidersFrom, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ErrorHandler } from '@angular/core';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { CsrfTokenInterceptor } from './auth/interceptors/csrftoken.interceptor';
import { ConfigService } from './services/config.service';
import { AuthInterceptor } from './auth/interceptors/auth.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';
import { loadingInterceptor } from './components/loading/loading.interceptor';
import { ToastrModule } from 'ngx-toastr';
import { PermissionService } from './services/permission.service';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { reducers } from './store';
import { StepperEffects } from './store/stepper/stepper.effects';
import { UserEffects } from './store/user/user.effects';
import { STORE_CONFIG, DEVTOOLS_CONFIG,metaReducers  } from './ngrx.config';

export function appInitialization() {
  const configService = inject(ConfigService);
  return configService.load();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(appInitialization),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([
        AuthInterceptor,
        loadingInterceptor
      ])
    ),
    provideAnimations(),
    importProvidersFrom(
      ToastrModule.forRoot({
        timeOut: 3000,
        positionClass: 'toast-top-right',
        preventDuplicates: true,
        closeButton: true
      })
    ),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },

    // ✅ NgRx Store - Runtime Checks ile
    provideStore(reducers, { ...STORE_CONFIG, metaReducers }),

    // ✅ NgRx Effects
    provideEffects([StepperEffects, UserEffects]),

    // ✅ NgRx DevTools - Geliştirilmiş Ayarlar
    ...(isDevMode() ? [provideStoreDevtools(DEVTOOLS_CONFIG)] : []),
  ]
};
