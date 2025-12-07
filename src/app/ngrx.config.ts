import { ErrorHandler, Injectable, isDevMode } from '@angular/core';
import { ActionReducer, MetaReducer, StoreConfig } from '@ngrx/store';
import { StoreDevtoolsConfig } from '@ngrx/store-devtools';

export const STORE_CONFIG: StoreConfig<any> & { runtimeChecks?: any } = {
  runtimeChecks: isDevMode() ? {
    strictStateImmutability: true,      // State mutasyonlarını yakalar
    strictActionImmutability: true,     // Action mutasyonlarını yakalar
    strictStateSerializability: true,   // Class instance'ları yakalar (UiPackage, UiProduct vb.)
    strictActionSerializability: true,  // Action payload'larındaki class'ları yakalar
    strictActionWithinNgZone: true,     // Zone dışı action'ları yakalar
    strictActionTypeUniqueness: true,   // Duplicate action type'ları yakalar
  } : {
    strictStateImmutability: false,
    strictActionImmutability: false,
    strictStateSerializability: false,
    strictActionSerializability: false,
    strictActionWithinNgZone: false,
    strictActionTypeUniqueness: false,
  }
};

export const DEVTOOLS_CONFIG: StoreDevtoolsConfig = {
  maxAge: 25,                 // Son 25 action'ı sakla
  logOnly: !isDevMode(),      // Production'da sadece log, development'ta tam özellikler
  autoPause: true,            // İnaktif sekmede otomatik durdur
  trace: isDevMode(),         // Stack trace aktif (mutasyon yerini gösterir)
  traceLimit: 75,             // Stack trace derinliği
  connectInZone: false,       // Zone içinde bağlan
  // features: {
  //   pause: true,                        // Manuel pause özelliği
  //   lock: true,                         // State lock özelliği
  //   // persist: true                       // State'i localStorage'da sakla
  // }
};

export function logger(reducer: ActionReducer<any>): ActionReducer<any> {
  return (state, action) => {
    const result = reducer(state, action);
    console.groupCollapsed(action.type);
    // console.log('prev state', state);
    // console.log('action', action);
    // console.log('next state', result);
    console.groupEnd();
    return result;
  };
}
export const metaReducers: MetaReducer<any>[] = isDevMode()
  ? [logger]
  : [];

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    console.error('🔴 Global Error:', error);

    // NgRx hatalarını özellikle logla
    if (error?.message?.includes('ngrx')) {
      console.error('🔴 NgRx Runtime Error:', {
        message: error.message,
        stack: error.stack
      });
    }
  }
}
