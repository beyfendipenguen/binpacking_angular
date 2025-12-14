import { Component, Inject, OnInit, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { OrderDetailService } from '@features/services/order-detail.service';
import { GenericTableComponent, ColumnDefinition, ExternalDataParams, ExternalDataResult } from '@shared/generic-table/generic-table.component';

@Component({
  selector: 'app-order-details-dialog',
  standalone: true,
  imports: [CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    GenericTableComponent,
    TranslateModule
  ],
  templateUrl: './order-details-dialog.component.html',
  styleUrl: './order-details-dialog.component.scss'
})
export class OrderDetailsDialogComponent implements OnInit {

  private translate = inject(TranslateService);
  orderDetailService = inject(OrderDetailService);

  // Table configuration
  displayedColumns: string[] = [
    'product.name',
    'count',
    'product.dimension.width',
    'product.dimension.depth',
    'product.dimension.height'
  ];

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'product.name',
      label: this.translate.instant('DIMENSIONS.PRODUCT_NAME'),
      type: 'text',
      required: true
    },
    {
      key: 'count',
      label: this.translate.instant('DIMENSIONS.QUANTITY'),
      type: 'number',
      required: true
    },
    {
      key: 'product.dimension.width',
      label: this.translate.instant('DIMENSIONS.WIDTH_MM'),
      type: 'number',
      required: false
    },
    {
      key: 'product.dimension.depth',
      label: this.translate.instant('DIMENSIONS.DEPTH_MM'),
      type: 'number',
      required: false
    },
    {
      key: 'product.dimension.height',
      label: this.translate.instant('DIMENSIONS.HEIGHT_MM'),
      type: 'number',
      required: false
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'product.name': this.translate.instant('DIMENSIONS.PRODUCT_NAME'),
    'product.dimension.width': this.translate.instant('DIMENSIONS.WIDTH_MM'),
    'product.dimension.depth': this.translate.instant('DIMENSIONS.DEPTH_MM'),
    'product.dimension.height': this.translate.instant('DIMENSIONS.HEIGHT_MM'),
    'count': this.translate.instant('DIMENSIONS.QUANTITY')
  };

  filterableColumns: string[] = [
    'product.name'
  ];

  constructor(
    public dialogRef: MatDialogRef<OrderDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      orderId: string;
      orderName: string;
      companyName: string;
    }
  ) { }

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * External data fetcher for order details
   */
  fetchOrderDetails = (params: ExternalDataParams): Observable<ExternalDataResult<any>> => {
    // Add order_id to params
    const detailParams = {
      ...params,
      order_id: this.data.orderId
    };

    return this.orderDetailService.getAll(detailParams);
  }

  /**
   * Close dialog
   */
  close(): void {
    this.dialogRef.close();
  }
}
