import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { OrderDetailsDialogComponent } from './dialogs/order-details-dialog/order-details-dialog.component';
import { PackageDialogComponent } from './dialogs/package-dialog/package-dialog.component';
import { FilesDialogComponent } from './dialogs/files-dialog/files-dialog.component';
import { FileService } from '@core/services/file.service';
import { GenericTableComponent, CellButtonClickEvent } from '@shared/generic-table/generic-table.component';
import { Order } from '../interfaces/order.interface';
import { OrderService } from '../services/order.service';
import { HasPermissionDirective } from "@app/core/auth/directives/has-permission.directive";
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { ColumnDefinition } from '@app/shared/generic-table/interfaces/column-definition.interface';
import { OrderHistoryDialogComponent } from './dialogs/order-history-dialog/order-history-dialog.component';
import { ChangeOrderNumberDialogComponent } from './dialogs/change-order-number-dialog/change-order-number-dialog.component';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatMenuModule,
    GenericTableComponent,
    HasPermissionDirective,
    DisableAuthDirective,
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
  copiedOrderId: string | null = null;

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
    'customer_view',
    'is_completed',
    'history',
    'created_by',
    'created_at',
  ];

  columnTypes: { [key: string]: string } = {
    'date': 'date',
    'created_at': 'date',
    'is_completed': 'status'
  };

  // NOT: label alanları çeviri ANAHTARI olarak tutulur (instant() ile önceden
  // çevrilmiş metin DEĞİL) — generic-table bu değerleri `| translate` pipe'ı
  // ile render eder, bu sayede dil değişince başlıklar sayfa yenilemeden
  // güncellenir. tooltip alanları bu kuralın dışında (template'te pipe'sız
  // kullanılıyor), o yüzden instant() ile aynen kalıyor.
  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'name',
      label: 'ORDER.ORDER_NAME',
      type: 'text',
      required: true,
      // order.extra_data doluysa (örn. ERP'den gelen preference/order_no)
      // üzerine gelince tooltip olarak gösterilsin — bkz.
      // GenericTableComponent.getCellTooltip()
      showRowExtraData: true
    },
    {
      key: 'date',
      label: 'INVOICE_UPLOAD.ORDER_DATE',
      type: 'text',
      required: true
    },
    {
      key: 'company_relation.target_company.company_name',
      label: 'ORDER.COMPANY_NAME',
      type: 'text',
      required: false
    },
    {
      key: 'company_relation.target_company.country',
      label: 'COMMON.COUNTRY',
      type: 'text',
      required: false
    },
    {
      key: 'order_details',
      label: 'ORDER_DETAILS.TITLE',
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
      label: 'PALLET.PALLETS',
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
      label: 'ORDER.FILES',
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
      key: 'history',
      label: 'ORDER_HISTORY.TITLE',
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'history',
        color: 'primary',
        tooltip: this.translate.instant('ORDER.VIEW_HISTORY'),
        class: 'history-button'
      }
    },
    {
      key: 'customer_view',
      label: 'ORDER.CUSTOMER_VIEW',
      type: 'button',
      required: false,
      buttonConfig: {
        icon: 'content_copy',
        color: 'primary',
        tooltip: this.translate.instant('ORDER.COPY_CUSTOMER_LINK'),
        class: 'customer-view-button'
      }
    },
    {
      key: 'is_completed',
      label: 'COMMON.STATUS',
      type: 'status',
      required: false,
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'company_relation.target_company.company_name': 'ORDER.COMPANY_NAME',
    'company_relation.target_company.country': 'COMMON.COUNTRY',
    'order_details': 'ORDER_DETAILS.TITLE',
    'package': 'PALLET.PALLETS',
    'files': 'ORDER.FILES',
    'date': 'INVOICE_UPLOAD.ORDER_DATE',
    'name': 'ORDER.ORDER_NAME',
    'is_completed': 'COMMON.STATUS',
    'history': 'ORDER_HISTORY.TITLE',
    'created_by': 'COMMON.USER',
    'created_at': 'ORDER.CREATION_DATE',
    'customer_view': 'ORDER.CUSTOMER_VIEW',
  };

  filterableColumns: string[] = [
    'name',
    'created_at'
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
      case 'customer_view':
        this.copyCustomerLink(row.id);
        break;
      case 'history':
        this.openHistoryDialog(row);
        break;
    }
  }

  /**
   * Sipariş numarası değiştirme dialog'u.
   * Yetki: orders.change_order_number (menü öğesi appDisableAuth ile korunuyor)
   */
  openChangeOrderNumberDialog(): void {
    const dialogRef = this.dialog.open(ChangeOrderNumberDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe((changed) => {
      if (changed) {
        // Tabloyu tazele — yeni sipariş adı görünsün
        this.genericTable?.loadData();
      }
    });
  }

  copyCustomerLink(orderId: string): void {
    const url = `${window.location.origin}/order-view/${orderId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copiedOrderId = orderId;
      setTimeout(() => this.copiedOrderId = null, 2000);
    });
  }

  /**
 * Open Order History Dialog
 */
  openHistoryDialog(order: Order): void {
    this.dialog.open(OrderHistoryDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      data: {
        orderId: order.id,
        orderName: order.name,
        companyName: order.company_relation?.target_company.company_name || 'N/A'
      }
    });
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
