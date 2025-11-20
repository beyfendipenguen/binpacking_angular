import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GenericTableComponent, ColumnDefinition } from '../../../../../components/generic-table/generic-table.component';
import { Observable } from 'rxjs';
import { ExternalDataParams, ExternalDataResult } from '../../../../../components/generic-table/generic-table.component';
import { OrderDetailService } from '../../../services/order-detail.service';

@Component({
  selector: 'app-order-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    GenericTableComponent
  ],
  templateUrl: './order-details-dialog.component.html',
  styleUrl: './order-details-dialog.component.scss'
})
export class OrderDetailsDialogComponent implements OnInit {
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
      label: 'Ürün Adı',
      type: 'text',
      required: true
    },
    {
      key: 'count',
      label: 'Adet',
      type: 'number',
      required: true
    },
    {
      key: 'product.dimension.width',
      label: 'Genişlik (mm)',
      type: 'number',
      required: false
    },
    {
      key: 'product.dimension.depth',
      label: 'Derinlik (mm)',
      type: 'number',
      required: false
    },
    {
      key: 'product.dimension.height',
      label: 'Yükseklik (mm)',
      type: 'number',
      required: false
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'product.name': 'Ürün Adı',
    'product.dimension.width': 'Genişlik (mm)',
    'product.dimension.depth': 'Derinlik (mm)',
    'product.dimension.height': 'Yükseklik (mm)',
    'count': 'Adet'
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
  ) {}

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
