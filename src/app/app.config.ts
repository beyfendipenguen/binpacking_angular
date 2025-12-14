import { ApplicationConfig, provideZoneChangeDetection, inject, provideAppInitializer, importProvidersFrom, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ErrorHandler } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';

// ✅ ngx-translate imports
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ConfigService } from './core/services/config.service';
import { AuthInterceptor } from './core/auth/interceptors/auth.interceptor';
import { GlobalErrorHandler } from './core/services/global-error-handler';
import { ToastrModule } from 'ngx-toastr';

import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { reducers } from './store';
import { UserEffects } from './store/user/user.effects';

import { StepperInvoiceUploadEffects } from './store/stepper/effects/stepper-invoice-upload.effects';
import { StepperPackageEffects } from './store/stepper/effects/stepper-package.effects';
import { StepperResultEffects } from './store/stepper/effects/stepper-result.effects';
import { StepperGeneralEffects } from './store/stepper/effects/stepper-general.effects';

import { STORE_CONFIG, DEVTOOLS_CONFIG, metaReducers } from './ngrx.config';
import { loadingInterceptor } from './shared/loading/loading.interceptor';
import { LanguageService } from './core/services/language.service';

// ✅ TranslateHttpLoader factory function
export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export function appInitialization() {
  const configService = inject(ConfigService);
  return configService.load();
}

export function initializeLanguage() {
  const languageService = inject(LanguageService);
  return Promise.resolve();
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(appInitialization),
    provideAppInitializer(initializeLanguage),
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
      }),
      // ✅ TranslateModule'ü burada ekle
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient]
        }
      })
    ),

    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },

    provideStore(reducers, { ...STORE_CONFIG, metaReducers }),

    provideEffects([
      StepperInvoiceUploadEffects,
      StepperPackageEffects,
      StepperResultEffects,
      StepperGeneralEffects,
      UserEffects
    ]),

    ...(isDevMode() ? [provideStoreDevtools(DEVTOOLS_CONFIG)] : [])
  ]
};
