import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from './generic-crud.service';
import { Document } from '@app/features/interfaces/file.interface';
import { Observable } from 'rxjs';
import { OrderDetailRead } from '@app/features/interfaces/order-detail.interface';
import { Order } from '@app/features/interfaces/order.interface';
import { FileResponse } from '@app/features/stepper/interfaces/file-response.interface';

@Injectable({
  providedIn: 'root'
})
export class FileService extends GenericCrudService<Document> {
  constructor(http: HttpClient) {
    super(http, 'orders/files');
  }

  downloadOrderTemplate(lang: string = 'tr'): Observable<Blob> {
    this.ensureApiUrl();
    const baseUrl = this.apiUrl.replace('orders/files/', '');
    return this.http.get(
      `${baseUrl}logistics/order-template/?lang=${lang}`,
      { responseType: 'blob' }
    );
  }

  downloadBlob(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  uploadFile(file: File, orderId: string, type: string): Observable<FileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('order_id', orderId);
    formData.append('type', type);

    return this.http.post<FileResponse>(
      `${this.api.getApiUrl()}/orders/files/`,
      formData
    );
  }

  processFile(
    file: File
  ): Observable<{ message: string; order: Order; orderDetail: OrderDetailRead[] }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{
      message: string;
      order: Order;
      orderDetail: OrderDetailRead[];
    }>(`${this.api.getApiUrl()}/logistics/process-file/`, formData);
  }
}
