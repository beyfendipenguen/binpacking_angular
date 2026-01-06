import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OrderDetailsDialogComponent } from './dialogs/order-details-dialog/order-details-dialog.component';
import { PackageDialogComponent } from './dialogs/package-dialog/package-dialog.component';
import { FilesDialogComponent } from './dialogs/files-dialog/files-dialog.component';
import { FileService } from '@core/services/file.service';
import { GenericTableComponent, ColumnDefinition, CellButtonClickEvent } from '@shared/generic-table/generic-table.component';
import { Order } from '../interfaces/order.interface';
import { OrderService } from '../services/order.service';
import { HasPermissionDirective } from "@app/core/auth/directives/has-permission.directive";

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    GenericTableComponent,
    HasPermissionDirective,
    TranslateModule,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit {

  private translate = inject(TranslateService);
  // Services
  orderService = inject(OrderService);
  fileService = inject(FileService);
  dialog = inject(MatDialog);
  router = inject(Router);

  @ViewChild(GenericTableComponent) genericTable!: GenericTableComponent<any>;

  // Table configuration
  displayedColumns: string[] = [
    'name',
    'date',
    'company_relation.target_company.company_name',
    'company_relation.target_company.country',
    'order_details',
    'package',
    'files',
    'is_completed',
    'created_by',
    'created_at',
  ];

  columnTypes: { [key: string]: string } = {
    'date': 'date',
    'created_at': 'date',
    'is_completed': 'status'
  };

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'name',
      label: this.translate.instant('ORDER.ORDER_NAME'),
      type: 'text',
      required: true
    },
    {
      key: 'date',
      label: this.translate.instant('INVOICE_UPLOAD.ORDER_DATE'),
      type: 'text',
      required: true
    },
    {
      key: 'company_relation.target_company.company_name',
      label: this.translate.instant('ORDER.COMPANY_NAME'),
      type: 'text',
      required: false
    },
    {
      key: 'company_relation.target_company.country',
      label: this.translate.instant('COMMON.COUNTRY'),
      type: 'text',
      required: false
    },
    {
      key: 'order_details',
      label: this.translate.instant('ORDER_DETAILS.TITLE'),
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'list_alt',
        color: 'primary',
        tooltip: this.translate.instant('ORDER.VIEW_PRODUCT_DETAILS'),
        class: 'details-button'
      }
    },
    {
      key: 'package',
      label: this.translate.instant('PALLET.PALLETS'),
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'inventory_2',
        color: 'primary',
        tooltip: this.translate.instant('ORDER.VIEW_PALLET_DETAILS'),
        class: 'package-button'
      }
    },
    {
      key: 'files',
      label: this.translate.instant('ORDER.FILES'),
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'folder',
        color: 'accent',
        tooltip: this.translate.instant('ORDER.VIEW_FILES'),
        class: 'files-button'
      }
    },
    {
      key: 'is_completed',
      label: this.translate.instant('COMMON.STATUS'),
      type: 'status',
      required: false,
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'company_relation.target_company.company_name': this.translate.instant('ORDER.COMPANY_NAME'),
    'company_relation.target_company.country': this.translate.instant('COMMON.COUNTRY'),
    'order_details': this.translate.instant('ORDER_DETAILS.TITLE'),
    'package': this.translate.instant('PALLET.PALLETS'),
    'files': this.translate.instant('ORDER.FILES'),
    'date': this.translate.instant('INVOICE_UPLOAD.ORDER_DATE'),
    'name': this.translate.instant('ORDER.ORDER_NAME'),
    'is_completed': this.translate.instant('COMMON.STATUS'),
    'created_by':this.translate.instant('COMMON.USER'),
    'created_at' : this.translate.instant('ORDER.CREATION_DATE')
  };

  filterableColumns: string[] = [
    'name',
    'date',
    'created_at',
    'company_relation.target_company.company_name',
    'company_relation.target_company.country_name',
  ];

  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Handle button clicks in table cells
   */
  onCellButtonClick(event: CellButtonClickEvent<any>): void {
    const { row, column } = event;

    switch (column) {
      case 'order_details':
        this.openOrderDetailsDialog(row);
        break;
      case 'package':
        this.openPackageDialog(row);
        break;
      case 'files':
        this.openFilesDialog(row);
        break;
    }
  }

  /**
   * Open Order Details Dialog
   */
  openOrderDetailsDialog(order: Order): void {
    this.dialog.open(OrderDetailsDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company.company_name || 'N/A'
      }
    });
  }

  /**
   * Open Package Dialog
   */
  openPackageDialog(order: Order): void {
    this.dialog.open(PackageDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company.company_name || 'N/A'
      }
    });
  }

  /**
   * Open Files Dialog
   */
  openFilesDialog(order: Order): void {
    this.dialog.open(FilesDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company.company_name || 'N/A'
      }
    });
  }

  /**
   * Handle row click - Navigate to edit page
   */
  onRowClick(order: Order): void {
    this.editOrder(order);
  }

  /**
   * Navigate to order edit page
   * ÖNEMLİ: Bu metod olduğu gibi kalacak, değiştirilmeyecek!
   */
  editOrder(order: Order): void {
    if (!order) {
      return;
    }

    const orderId = order.id;

    // Ana sayfaya orderId ile yönlendir
    this.router.navigate(['/'], {
      queryParams: {
        orderId: orderId,
        mode: 'edit'
      }
    });
  }

  /**
   * Get file icon based on file type
   */
  getFileIcon(fileType: string | null): string {
    if (!fileType) return 'insert_drive_file';

    const type = fileType.toLowerCase();

    if (type.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') || type.includes('png')) {
      return 'image';
    } else if (type.includes('excel') || type.includes('sheet') || type.includes('xlsx') || type.includes('xls')) {
      return 'table_chart';
    } else if (type.includes('word') || type.includes('doc')) {
      return 'description';
    } else if (type.includes('zip') || type.includes('rar') || type.includes('archive')) {
      return 'folder_zip';
    } else if (type.includes('text') || type.includes('txt')) {
      return 'article';
    } else if (type.includes('video')) {
      return 'videocam';
    } else if (type.includes('audio')) {
      return 'audiotrack';
    }

    return 'insert_drive_file';
  }
}
