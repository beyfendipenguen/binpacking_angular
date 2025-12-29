import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ActiveToast, ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private toastr: ToastrService) {}
  translate = inject(TranslateService);


  success(message: string, title: string = this.translate.instant('COMMON.SUCCESS')): void {
    this.toastr.success(message, title);
  }

  error(message: string, title: string = this.translate.instant('COMMON.ERROR')): void {
    this.toastr.error(message, title);
  }

  warning(message: string, title: string = this.translate.instant('COMMON.WARNING')): void {
    this.toastr.warning(message, title);
  }

  info(message: string, title: string = this.translate.instant('COMMON.INFO')): void {
    this.toastr.info(message, title);
  }

  stickyError(message: string, title: string = this.translate.instant('COMMON.ERROR')): ActiveToast<any> {
    return this.toastr.error(message, title, {
      disableTimeOut: true,
      closeButton: true,
      tapToDismiss: false
    });
  }

  stickyWarning(message: string, title: string = this.translate.instant('COMMON.WARNING')): ActiveToast<any> {
    return this.toastr.warning(message, title, {
      disableTimeOut: true,
      closeButton: true,
      tapToDismiss: false
    });
  }

  clear(toastId?: number): void {
    this.toastr.clear(toastId);
  }

  clearAll(): void {
    this.toastr.clear();
  }
}
