import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

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
}
