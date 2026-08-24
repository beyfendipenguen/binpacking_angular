import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { ToastService } from '@app/core/services/toast.service';
import { ErpIntegrationService } from '@app/features/services/erp-integration.service';
import { ErpCredential, ErpOrderSummary, ErpRowImportState } from '@app/features/interfaces/erp-integration.interface';
import { ErpCredentialDialogComponent } from './dialogs/erp-credential-dialog/erp-credential-dialog.component';

@Component({
  selector: 'app-integration',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    TranslateModule,
    HasPermissionDirective,
    DisableAuthDirective,
  ],
  templateUrl: './integration.component.html',
  styleUrl: './integration.component.scss',
})
export class IntegrationComponent implements OnInit, AfterViewInit, OnDestroy {
  private erpService = inject(ErpIntegrationService);
  private dialog = inject(MatDialog);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  credential: ErpCredential | null = null;
  isCredentialLoading = false;

  dataSource = new MatTableDataSource<ErpOrderSummary>([]);
  pageSizeOptions = [10, 25, 50];
  displayedColumns: string[] = [
    'order_number',
    'customer_name',
    'customer_code',
    'date',
    'status',
    'actions',
  ];

  isFetchingOrders = false;
  hasFetchedOnce = false;

  /**
   * Her sipariş numarasının anlık durumu — sadece o an tıklanan satır için
   * geçici (importing) değil, aynı zamanda "imported"/"failed" olarak
   * KALICI (aynı fetch oturumu boyunca) tutulur ki kullanıcı butona tekrar
   * bakmadan da aktarıp aktarmadığını görebilsin. already_imported=true
   * gelen satırlar (bkz. erp_list_orders_task) fetch anında 'imported'
   * ile başlatılır.
   */
  private rowStates = new Map<string, ErpRowImportState>();
  private rowErrors = new Map<string, string>();

  ngOnInit(): void {
    this.loadCredentialStatus();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCredentialStatus(): void {
    this.isCredentialLoading = true;
    this.erpService.getMyCredential().subscribe({
      next: (credential) => {
        this.credential = credential;
        this.isCredentialLoading = false;
      },
      error: () => {
        this.isCredentialLoading = false;
      },
    });
  }

  openCredentialDialog(): void {
    const dialogRef = this.dialog.open(ErpCredentialDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadCredentialStatus();
      }
    });
  }

  fetchOrders(): void {
    if (this.isFetchingOrders) return;
    this.isFetchingOrders = true;

    this.erpService.requestOrderList().subscribe({
      next: () => {
        this.erpService
          .pollOrderList()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (status) => {
              this.isFetchingOrders = false;
              this.hasFetchedOnce = true;
              if (status.state === 'error') {
                this.toastService.error(status.error || this.translate.instant('INTEGRATION.FETCH_ERROR'));
                this.dataSource.data = [];
                return;
              }
              const orders = status.orders || [];
              this.dataSource.data = orders;
              if (this.paginator) {
                this.paginator.firstPage();
              }

              // Satır durumlarını sıfırla, backend'in işaretlediği
              // already_imported=true olanları 'imported' ile, en son
              // denemesi başarısız olanları (last_import_error) 'failed'
              // ile başlat — aksi halde sayfa yenilenip tekrar "Siparişleri
              // Çek" yapıldığında DB'de FAILED kaydı olsa bile buton sanki
              // hiç denenmemiş gibi "İçeri Aktar" gösteriyordu.
              this.rowStates.clear();
              this.rowErrors.clear();
              orders.forEach((order) => {
                if (order.already_imported) {
                  this.rowStates.set(order.order_number, 'imported');
                } else if (order.last_import_error) {
                  this.rowStates.set(order.order_number, 'failed');
                  this.rowErrors.set(order.order_number, order.last_import_error);
                }
              });

              this.toastService.success(
                this.translate.instant('INTEGRATION.ORDERS_FETCHED', { count: orders.length })
              );
            },
            error: (err) => {
              this.isFetchingOrders = false;
              this.toastService.error(err?.error?.errors?.[0]?.message ?? this.translate.instant('INTEGRATION.FETCH_ERROR'));
            },
          });
      },
      error: (err) => {
        this.isFetchingOrders = false;
        this.toastService.error(err?.error?.errors?.[0]?.message ?? this.translate.instant('INTEGRATION.FETCH_ERROR'));
      },
    });
  }

  /** Satırın anlık durumu — template'te buton etiketi/ikonu bunu okur. */
  getRowState(orderNumber: string): ErpRowImportState {
    return this.rowStates.get(orderNumber) || 'idle';
  }

  getRowError(orderNumber: string): string | undefined {
    return this.rowErrors.get(orderNumber);
  }

  canImport(orderNumber: string): boolean {
    const state = this.getRowState(orderNumber);
    return state === 'idle' || state === 'failed';
  }

  importOrder(row: ErpOrderSummary): void {
    if (!this.canImport(row.order_number)) return;

    this.rowStates.set(row.order_number, 'importing');
    this.rowErrors.delete(row.order_number);

    this.erpService.requestImportOrder(row.order_number).subscribe({
      next: () => {
        this.erpService
          .pollImportOrder()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (status) => {
              if (status.state === 'error') {
                this.rowStates.set(row.order_number, 'failed');
                const message = status.error || this.translate.instant('INTEGRATION.IMPORT_ERROR');
                this.rowErrors.set(row.order_number, message);
                this.toastService.error(message);
                return;
              }
              this.rowStates.set(row.order_number, 'imported');
              this.toastService.success(
                this.translate.instant('INTEGRATION.ORDER_IMPORTED', { order_name: status.order_name })
              );
            },
            error: (err) => {
              this.rowStates.set(row.order_number, 'failed');
              const message = err?.error?.errors?.[0]?.message ?? this.translate.instant('INTEGRATION.IMPORT_ERROR');
              this.rowErrors.set(row.order_number, message);
              this.toastService.error(message);
            },
          });
      },
      error: (err) => {
        // Backend'in hızlı ret yolu (view'de 400) — örn. "zaten aktarılmış".
        this.rowStates.set(row.order_number, 'failed');
        const message = err?.error?.errors?.[0]?.message ?? this.translate.instant('INTEGRATION.IMPORT_ERROR');
        this.rowErrors.set(row.order_number, message);
        this.toastService.error(message);
      },
    });
  }

  getColumnName(column: string): string {
    const names: { [key: string]: string } = {
      order_number: this.translate.instant('INTEGRATION.ORDER_NUMBER'),
      customer_name: this.translate.instant('INTEGRATION.CUSTOMER_NAME'),
      customer_code: this.translate.instant('INTEGRATION.CUSTOMER_CODE'),
      date: this.translate.instant('ORDER.CREATION_DATE'),
      status: this.translate.instant('COMMON.STATUS'),
      actions: this.translate.instant('MENU.OPERATIONS'),
    };
    return names[column] || column;
  }
}
