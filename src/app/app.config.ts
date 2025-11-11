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
    provideStore(reducers, {
      runtimeChecks: {
        strictStateImmutability: true,      // State mutasyonlarını yakalar
        strictActionImmutability: true,     // Action mutasyonlarını yakalar
        strictStateSerializability: true,   // Class instance'ları yakalar (UiPackage, UiProduct vb.)
        strictActionSerializability: true,  // Action payload'larındaki class'ları yakalar
        strictActionWithinNgZone: true,     // Zone dışı action'ları yakalar
        strictActionTypeUniqueness: true,   // Duplicate action type'ları yakalar
      }
    }),

    // ✅ NgRx Effects
    provideEffects([StepperEffects, UserEffects]),

    // ✅ NgRx DevTools - Geliştirilmiş Ayarlar
    provideStoreDevtools({
      maxAge: 25,                           // Son 25 action'ı sakla
      logOnly: !isDevMode(),                // Production'da sadece log, development'ta tam özellikler
      autoPause: true,                      // İnaktif sekmede otomatik durdur
      trace: true,                          // Stack trace aktif (mutasyon yerini gösterir)
      traceLimit: 75,                       // Stack trace derinliği
      connectInZone: true,                  // Zone içinde bağlan
      // features: {
      //   pause: true,                        // Manuel pause özelliği
      //   lock: true,                         // State lock özelliği
      //   // persist: true                       // State'i localStorage'da sakla
      // }
    }),
  ]
};
