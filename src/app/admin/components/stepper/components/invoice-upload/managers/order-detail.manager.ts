import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { OrderDetailChanges } from '../models/invoice-upload-interfaces';
import { RepositoryService } from '../../../services/repository.service';
import { OrderDetailAddDialogComponent } from '../order-detail-add-dialog/order-detail-add-dialog.component';
import { INVOICE_UPLOAD_CONSTANTS } from '../constants/invoice-upload.constants';
import { ToastService } from '../../../../../../services/toast.service';
import { OrderDetailRead } from '../../../../../../models/order-detail.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderDetailManager {
  private readonly dialog = inject(MatDialog);
  private readonly toastService = inject(ToastService);
  private readonly repositoryService = inject(RepositoryService);

  private orderDetails: OrderDetailRead[] = [];

  setOrderDetails(orderDetails: OrderDetailRead[]): void {
    this.orderDetails = [...orderDetails];
  }

  addOrderDetail(orderDetail: OrderDetailRead): void {
    this.orderDetails.unshift(orderDetail);
  }


  openOrderDetailDialog(): Observable<OrderDetailRead | null> {
    const dialogRef = this.dialog.open(OrderDetailAddDialogComponent, {
      width: '600px',
      disableClose: true,
    });

    return new Observable(observer => {
      dialogRef.afterClosed().subscribe({
        next: (result) => {
          if (result && result.orderDetail) {
            this.toastService.success(INVOICE_UPLOAD_CONSTANTS.MESSAGES.SUCCESS.ORDER_DETAIL_ADDED);
            observer.next(result.orderDetail);
          } else {
            observer.next(null);
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }


  getOrderDetailById(id: string): OrderDetailRead | undefined {
    return this.orderDetails.find(detail => detail.id === id);
  }


}
