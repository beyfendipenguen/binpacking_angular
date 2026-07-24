import { Component, Inject, OnInit, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { OrderDetailService } from '@features/services/order-detail.service';
import { GenericTableComponent, ExternalDataParams, ExternalDataResult } from '@shared/generic-table/generic-table.component';
import { ColumnDefinition } from '@app/shared/generic-table/interfaces/column-definition.interface';

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

  // NOT: label çeviri ANAHTARı olarak tutulur — generic-table `| translate`
  // pipe'ıyla render eder, dil değişince başlık günceller (instant() ile
  // önceden çevirirsek dondurulmuş metin dil değişikliğini yakalayamaz).
  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'product.name',
      label: 'DIMENSIONS.PRODUCT_NAME',
      type: 'text',
      required: true
    },
    {
      key: 'count',
      label: 'DIMENSIONS.QUANTITY',
      type: 'number',
      required: true
    },
    {
      key: 'product.dimension.width',
      label: 'DIMENSIONS.WIDTH_MM',
      type: 'number',
      required: false
    },
    {
      key: 'product.dimension.depth',
      label: 'DIMENSIONS.DEPTH_MM',
      type: 'number',
      required: false
    },
    {
      key: 'product.dimension.height',
      label: 'DIMENSIONS.HEIGHT_MM',
      type: 'number',
      required: false
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'product.name': 'DIMENSIONS.PRODUCT_NAME',
    'product.dimension.width': 'DIMENSIONS.WIDTH_MM',
    'product.dimension.depth': 'DIMENSIONS.DEPTH_MM',
    'product.dimension.height': 'DIMENSIONS.HEIGHT_MM',
    'count': 'DIMENSIONS.QUANTITY'
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
