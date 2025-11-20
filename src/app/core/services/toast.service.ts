import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private toastr: ToastrService) {}

  success(message: string, title: string = 'Başarılı'): void {
    this.toastr.success(message, title);
  }

  error(message: string, title: string = 'Hata'): void {
    this.toastr.error(message, title);
  }

  warning(message: string, title: string = 'Uyarı'): void {
    this.toastr.warning(message, title);
  }

  info(message: string, title: string = 'Bilgi'): void {
    this.toastr.info(message, title);
  }
}
