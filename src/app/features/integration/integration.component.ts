import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { ToastService } from '@app/core/services/toast.service';
import { ErpIntegrationService } from '@app/features/services/erp-integration.service';
import { ErpCredential, ErpListPageInfo, ErpOrderSummary, ErpRowImportState } from '@app/features/interfaces/erp-integration.interface';
import { ErpCredentialDialogComponent } from './dialogs/erp-credential-dialog/erp-credential-dialog.component';

@Component({
  selector: 'app-integration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
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
export class IntegrationComponent implements OnInit, OnDestroy {
  private erpService = inject(ErpIntegrationService);
  private dialog = inject(MatDialog);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  private destroy$ = new Subject<void>();

  credential: ErpCredential | null = null;
  isCredentialLoading = false;

  dataSource = new MatTableDataSource<ErpOrderSummary>([]);
  pageSizeOptions = [10, 25, 50];

  /**
   * Server-side sayfalama — bkz. SanicaConnector.list_orders
   * (GetDataTableWithPagingSQL). dataSource her zaman SADECE o an istenen
   * sayfanın satırlarını taşır, mat-paginator'a artık dataSource.paginator
   * ile BAĞLANMIYOR (client-side'a düşmesin diye); (page) event'i doğrudan
   * yeni bir backend isteği tetikler (bkz. onPageChange).
   */
  currentPage = 0; // mat-paginator pageIndex, 0 tabanlı
  pageSize = 10;
  totalItems = 0;

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

  /**
   * ERP tarafında (SanicaConnector._build_list_sql'deki search parametresi)
   * docNo, cari ismi ve cari no üzerinden aranır — bkz. servis katmanındaki
   * filters.search. Debounce'lu, kullanıcı yazmayı bıraktıktan sonra otomatik
   * fetchOrders() tetiklenir (ayrı bir "Ara" butonuna gerek yok).
   */
  searchControl = new FormControl('');

  get isSearchActive(): boolean {
    return !!this.searchControl.value?.trim();
  }

  ngOnInit(): void {
    this.loadCredentialStatus();
    this.setupSearchDebounce();
  }

  private setupSearchDebounce(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        // Sadece credential yapılandırılmışsa arama tetiklensin — aksi halde
        // fetchOrders zaten erp/list-orders'a hiç gitmeden başarısız olur.
        if (this.credential?.is_configured) {
          this.refreshOrders();
        }
      });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  /**
   * Yeni bir sonuç kümesi başlatan tetikleyiciler (manuel "Siparişleri Çek",
   * arama değişimi) için — ilk sayfaya döner. mat-paginator'ın kendisinden
   * gelen (page) event'i (onPageChange) bunu ÇAĞIRMAZ, aksi halde ileri/geri
   * tıklaması kendi kendini sıfırlardı.
   */
  refreshOrders(): void {
    this.currentPage = 0;
    this.fetchOrders();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.fetchOrders();
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

        // Credential zaten yapılandırılmışsa siparişleri kullanıcı "Siparişleri
        // Çek" butonuna basmadan OTOMATİK çek — buton yine de duruyor (manuel
        // yenileme için), ama sayfa ilk açıldığında veri görmek için tıklamaya
        // gerek yok.
        if (credential?.is_configured) {
          this.refreshOrders();
        }
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

    // page 1 tabanlı (backend sözleşmesi — bkz. SanicaConnector.list_orders),
    // mat-paginator'ın 0 tabanlı currentPage'inden +1 ile çevriliyor. Arama
    // kutusu doluysa filters.search da eklenir — connector (bkz.
    // SanicaConnector.list_orders/_build_list_sql) bunu docNo/cari ismi/cari
    // no üzerinde arar; tarih aralığı kısıtı yok, sayfalama tüm geçmiş
    // üzerinde çalışır.
    const search = (this.searchControl.value || '').trim();
    const filters: Record<string, any> = {
      page: this.currentPage + 1,
      page_size: this.pageSize,
    };
    if (search) {
      filters['search'] = search;
    }

    this.erpService.requestOrderList(filters).subscribe({
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
              this.updateTotalItems(orders.length, status.page_info);

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

  /**
   * mat-paginator'ın [length] input'unu besler. page_info.total_count doluysa
   * (sayfalama YAPABİLEN bir connector — bkz. ErpListPageInfo) OLDUĞU GİBİ
   * kullanılır. Yoksa (connector desteklemiyorsa) toplam BİLİNMEDEN, sadece
   * "bu sayfa tam doluysa muhtemelen sonraki sayfa da vardır" mantığıyla
   * "İleri" butonunu aktif tutacak tahmini bir uzunluk hesaplanır.
   */
  private updateTotalItems(receivedCount: number, pageInfo?: ErpListPageInfo | null): void {
    if (pageInfo?.total_count != null) {
      this.totalItems = pageInfo.total_count;
      return;
    }
    const seenSoFar = this.currentPage * this.pageSize + receivedCount;
    this.totalItems = receivedCount === this.pageSize ? seenSoFar + this.pageSize : seenSoFar;
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
              // NOT: row, dataSource.data içindeki asıl satır nesnesine
              // referans — sayfa yenilenmeden "Siparişe Git" butonunun
              // görünmesi için order_id'yi buraya, backend'in import
              // sonucunda döndürdüğü yeni sipariş id'siyle DOĞRUDAN
              // yazıyoruz. Eskiden sadece rowStates güncelleniyordu; HTML
              // ise butonu row.order_id'ye göre gösterdiği için (bkz.
              // template `@if (row.order_id)`) sadece "Siparişleri Çek"
              // ile yeniden fetch edilince (backend already_imported+order_id
              // döndürünce) görünüyordu.
              if (status.order_id) {
                row.order_id = status.order_id;
              }
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

  /**
   * Zaten aktarılmış bir siparişi, ana sayfada edit modunda açar — bkz.
   * orders.component.ts'teki editOrder() ile AYNI navigasyon deseni
   * (queryParams: orderId + mode=edit).
   */
  goToOrder(orderId: string | null | undefined): void {
    if (!orderId) return;

    this.router.navigate(['/'], {
      queryParams: {
        orderId: orderId,
        mode: 'edit',
      },
    });
  }

  /**
   * Sipariş Yönetimi (Orders) sayfasına genel geçiş — orders.component.ts'teki
   * "Entegrasyona Git" butonunun ayna görevi, kullanıcı iki sayfa arasında
   * hızlıca geçiş yapabilsin diye.
   */
  goToOrdersList(): void {
    this.router.navigate(['/orders']);
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
