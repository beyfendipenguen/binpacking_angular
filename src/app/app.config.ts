import { ApplicationConfig, provideZoneChangeDetection, inject, provideAppInitializer, importProvidersFrom, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ErrorHandler } from '@angular/core';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ConfigService } from './core/services/config.service';
import { AuthInterceptor } from './core/auth/interceptors/auth.interceptor';
import { GlobalErrorHandler } from './core/services/global-error-handler';
import { ToastrModule } from 'ngx-toastr';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { reducers } from './store';
import { UserEffects } from './store/user/user.effects';

// ✅ Stepper Effects - 4 gruba ayrıldı
import { StepperInvoiceUploadEffects } from './store/stepper/effects/stepper-invoice-upload.effects';
import { StepperPackageEffects } from './store/stepper/effects/stepper-package.effects';
import { StepperResultEffects } from './store/stepper/effects/stepper-result.effects';
import { StepperGeneralEffects } from './store/stepper/effects/stepper-general.effects';

import { STORE_CONFIG, DEVTOOLS_CONFIG, metaReducers } from './ngrx.config';
import { loadingInterceptor } from './shared/loading/loading.interceptor';

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

    // ✅ NgRx Effects - Refactored: 4 Stepper Effect + 1 User Effect
    provideEffects([
      // Stepper Effects (4 grup)
      StepperInvoiceUploadEffects,
      StepperPackageEffects,
      StepperResultEffects,
      StepperGeneralEffects,

      // User Effects
      UserEffects
    ]),

    // ✅ NgRx DevTools - Geliştirilmiş Ayarlar
    ...(isDevMode() ? [provideStoreDevtools(DEVTOOLS_CONFIG)] : [])
  ]
};
