import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OrderService } from '../services/order.service';
import { OrderDetailService } from '../services/order-detail.service';
import { PackageDetailService } from '../services/package-detail.service';
import { FileService } from '../services/file.service';
import { GenericTableComponent, ColumnDefinition, CellButtonClickEvent } from '../../../components/generic-table/generic-table.component';
import { OrderDetailsDialogComponent } from './dialogs/order-details-dialog/order-details-dialog.component';
import { PackageDialogComponent } from './dialogs/package-dialog/package-dialog.component';
import { FilesDialogComponent } from './dialogs/files-dialog/files-dialog.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    GenericTableComponent
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit {
  // Services
  orderService = inject(OrderService);
  orderDetailService = inject(OrderDetailService);
  packageDetailService = inject(PackageDetailService);
  fileService = inject(FileService);
  dialog = inject(MatDialog);
  router = inject(Router);

  @ViewChild(GenericTableComponent) genericTable!: GenericTableComponent<any>;

  // Table configuration
  displayedColumns: string[] = [
    'name',
    'date',
    'created_at',
    'company_relation.target_company_name',
    'company_relation.target_company_country_name',
    'order_details',
    'package',
    'files',
    'is_completed'
  ];

  columnTypes: { [key: string]: string } = {
    'date': 'date',
    'created_at': 'date',
    'is_completed': 'status'
  };

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'name',
      label: 'Sipariş Adı',
      type: 'text',
      required: true
    },
    {
      key: 'date',
      label: 'Sipariş Tarihi',
      type: 'text',
      required: true
    },
    {
      key: 'created_at',
      label: 'Oluşturma Tarihi',
      type: 'text',
      required: true
    },
    {
      key: 'company_relation.target_company_name',
      label: 'Firma Adı',
      type: 'text',
      required: false
    },
    {
      key: 'company_relation.target_company_country_name',
      label: 'Ülke',
      type: 'text',
      required: false
    },
    {
      key: 'order_details',
      label: 'Ürün Detayları',
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'list_alt',
        color: 'primary',
        tooltip: 'Ürün Detaylarını Görüntüle',
        class: 'details-button'
      }
    },
    {
      key: 'package',
      label: 'Paletler',
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'inventory_2',
        color: 'primary',
        tooltip: 'Palet Detaylarını Görüntüle',
        class: 'package-button'
      }
    },
    {
      key: 'files',
      label: 'Dosyalar',
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'folder',
        color: 'accent',
        tooltip: 'Dosyaları Görüntüle',
        class: 'files-button'
      }
    },
    {
      key: 'is_completed',
      label: 'Durum',
      type: 'status',
      required: false,
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'company_relation.target_company_name': 'Firma Adı',
    'company_relation.target_company_country_name': 'Ülke',
    'order_details': 'Ürün Detayları',
    'package': 'Paletler',
    'files': 'Dosyalar',
    'date': 'Sipariş Tarihi',
    'created_at': 'Oluşturma Tarihi',
    'name': 'Sipariş Adı',
    'is_completed': 'Durum',
  };

  filterableColumns: string[] = [
    'name',
    'date',
    'created_at',
    'company_relation.target_company_name',
    'company_relation.target_company_country_name',
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
  openOrderDetailsDialog(order: any): void {
    this.dialog.open(OrderDetailsDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company_name || 'N/A'
      }
    });
  }

  /**
   * Open Package Dialog
   */
  openPackageDialog(order: any): void {
    this.dialog.open(PackageDialogComponent, {
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company_name || 'N/A'
      }
    });
  }

  /**
   * Open Files Dialog
   */
  openFilesDialog(order: any): void {
    this.dialog.open(FilesDialogComponent, {
      width: '800px',
      maxHeight: '80vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company_name || 'N/A'
      }
    });
  }

  /**
   * Handle row click - Navigate to edit page
   */
  onRowClick(order: any): void {
    this.editOrder(order);
  }

  /**
   * Navigate to order edit page
   * ÖNEMLİ: Bu metod olduğu gibi kalacak, değiştirilmeyecek!
   */
  editOrder(order: any): void {
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
