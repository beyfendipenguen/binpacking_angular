import { ApplicationConfig, provideZoneChangeDetection, inject, provideAppInitializer, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
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
import { provideStoreDevtools, StoreDevtoolsModule } from '@ngrx/store-devtools';
import { reducers } from './store';
import { StepperEffects } from './store/stepper/stepper.effects';
import { UserEffects } from './store/user/user.effects';

export function appInitialization() {
  const configService = inject(ConfigService);

  // Directly return the promise chain
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
      ]
      )
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
      provide: ErrorHandler, useClass: GlobalErrorHandler
    },
    provideStore(reducers,
      {
        runtimeChecks: {
          strictStateImmutability: true,      // State mutasyonlarını yakalar
          strictActionImmutability: true,     // Action mutasyonlarını yakalar
          strictStateSerializability: true,   // Class instance'ları yakalar (UiPackage, UiProduct vb.)
          strictActionSerializability: true,  // Action payload'larındaki class'ları yakalar
          strictActionWithinNgZone: true,     // Zone dışı action'ları yakalar
          strictActionTypeUniqueness: true,   // Duplicate action type'ları yakalar
        }
      }
    ),
    provideEffects([StepperEffects, UserEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false,
      trace: true, // <-- SET THIS TO TRUE FOR TRACING
      traceLimit: 75, // The maximum number of stack frames to be stored (default: 10)
    }),
  ]
};
