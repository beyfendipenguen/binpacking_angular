import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, inject, Injectable, Injector, NgZone } from '@angular/core';
import { Router } from '@angular/router';


export interface CustomBackendError {
  status: string;
  status_code: number;
  type: string;
  message: string;
  code: string;
  errors: any[];
}

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(private injector: Injector) { }

  handleError(error: any): void {
    // Http Hatası mı kontrol et (Backend'den gelen)
    if (error instanceof HttpErrorResponse) {
      this.handleBackendError(error);
    } else {
      console.group('%c ⚠️ Application Error ', 'background: #f39c12; color: #fff; font-size: 12px; padding: 2px;');
      console.error(error);
      console.groupEnd();
    }
  }

  private handleBackendError(error: HttpErrorResponse): void {
    // Backend senin formatında bir body dönmüş mü?
    const backendError = error.error as CustomBackendError;

    // Eğer backend beklediğin formatta yanıt dönmediyse (örn: 500 html sayfası veya network hatası)
    if (!backendError || !backendError.status_code) {
      console.error('Bilinmeyen HTTP Hatası:', error.message);
      return;
    }

    // --- KONSOL FORMATLAMA ---
    console.group(`%c 🚨 API Error: ${backendError.message} `, 'background: #e74c3c; color: #fff; font-size: 14px; padding: 4px; border-radius: 4px;');

    console.log(`%cStatus Code:`, 'font-weight: bold; color: #e74c3c', backendError.status_code);
    console.log(`%cType:`, 'font-weight: bold; color: #3498db', backendError.type);
    console.log(`%cCode:`, 'font-weight: bold; color: #9b59b6', backendError.code);

    if (backendError.errors && backendError.errors.length > 0) {
      console.groupCollapsed('%c Detaylı Hata Listesi', 'color: #e67e22');
      console.table(backendError.errors); // Hata listesini tablo olarak basar
      console.groupEnd();
    }

    console.groupEnd(); // Ana grubu kapat
  }
}


