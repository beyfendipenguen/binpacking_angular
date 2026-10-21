import { EnvironmentProviders, importProvidersFrom, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideToastr } from 'ngx-toastr';
import { provideMockActions } from '@ngrx/effects/testing';
import { EMPTY } from 'rxjs';
import { reducers } from '@app/store';

/** Gerçek reducer'lardan üretilen tam başlangıç state'i — selector'lar undefined feature'a düşmesin. */
export const TEST_INITIAL_STATE: any = Object.fromEntries(
  Object.entries(reducers).map(([key, reducer]) => [key, (reducer as any)(undefined, { type: '@@test/init' })])
);

/**
 * Birim testlerinde bileşen/servislerin ihtiyaç duyduğu ortak bağımlılıklar:
 * Store (mock), Translate, Toastr, Router, HttpClient (test), Material dialog ref/data.
 */
export const COMMON_TEST_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideNoopAnimations(),
  provideRouter([]),
  provideMockStore({ initialState: TEST_INITIAL_STATE }),
  provideMockActions(() => EMPTY),
  provideToastr(),
  importProvidersFrom(TranslateModule.forRoot()),
  { provide: MatDialogRef, useValue: { close: () => {}, afterClosed: () => ({ subscribe: () => {} }) } },
  { provide: MAT_DIALOG_DATA, useValue: {} },
];
