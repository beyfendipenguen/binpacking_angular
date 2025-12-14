import {
  Component,
  OnInit,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  inject,
  AfterViewInit,
  SimpleChanges,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  MatPaginator,
  MatPaginatorModule,
  PageEvent,
} from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { GenericCrudService, Page } from '../../core/services/generic-crud.service';
import { FilterDialogComponent } from './filter-dialog/filter-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AddOrUpdateDialogComponent } from './add-or-update-dialog/add-or-update-dialog-component';
import { ToastService } from '../../core/services/toast.service';
import { Observable, of } from 'rxjs';

// Interface for external data source
export interface ExternalDataParams {
  offset: number;
  limit: number;
  ordering?: string;
  [key: string]: any; // Any additional filter parameters
}

// Interface for external data result
export interface ExternalDataResult<T> {
  results: T[];
  count: number;
}

// Interface for button configuration in columns
export interface ButtonConfig {
  icon?: string;
  text?: string;
  color?: 'primary' | 'accent' | 'warn';
  tooltip?: string;
  class?: string;
}

// Interface for column definition with button support
export interface ColumnDefinition {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  buttonConfig?: ButtonConfig;
}

// Interface for cell button click event
export interface CellButtonClickEvent<T> {
  row: T;
  column: string;
}

@Component({
  selector: 'app-generic-table',
  imports: [CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatButtonToggleModule,
    TranslateModule
  ],
  providers: [DatePipe],
  templateUrl: './generic-table.component.html',
  styleUrl: './generic-table.component.scss',
})
export class GenericTableComponent<T> implements OnInit, AfterViewInit {

  private translate = inject(TranslateService);
  @Input() service?: GenericCrudService<T>; // Optional now
  @Input() displayedColumns: string[] = [];
  @Input() columnTypes: { [key: string]: string } = {};
  @Input() title: string = 'Items';
  @Input() filterableColumns: string[] = [];
  @Input() relationOptions: { [key: string]: any[] } = {};
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() nestedDisplayColumns: { [key: string]: string } = {}; // İç içe sütunlar için görünen başlıklar
  @Input() showRowNumbers: boolean = true; // Sıra numaralarını gösterme ayarı
  @Input() showAddButton: boolean = true; // Ekleme butonu gösterme ayarı
  @Input() showUpdateButton: boolean = true; // Güncelleme butonu gösterme ayarı
  @Input() showDeleteButton: boolean = true; // Silme butonu gösterme ayarı
  @Input() excludeFields: string[] = [];

  @Input() parentId: string | undefined = undefined; // Bağlı olduğu üst nesne ID'si
  @Input() useParentId: boolean = false; // Üst nesne ID kullanılacak mı belirteci
  @Input() parentIdFieldName: string = 'order_id'; // API'ye gönderilecek parametre adı

  // External data source inputs
  @Input() externalData?: T[]; // External data array input
  @Input() externalTotalCount?: number; // Total count for pagination
  @Input() externalDataFetcher?: (params: ExternalDataParams) => Observable<ExternalDataResult<T>>; // Function to fetch external data

  // Outputs for external data operations
  @Output() externalDataUpdate = new EventEmitter<{ item: T, data: any }>(); // Event for updating an item externally
  @Output() externalDataCreate = new EventEmitter<any>(); // Event for creating an item externally
  @Output() externalDataDelete = new EventEmitter<any>(); // Event for deleting an item externally

  @Output() rowClick = new EventEmitter<T>();
  @Output() rowDeleted = new EventEmitter<any>();
  @Output() addClick = new EventEmitter<void>(); // Yeni ekleme düğmesi tıklama olayı
  @Output() updateItem = new EventEmitter<T>();
  @Output() itemAdded = new EventEmitter<T>(); // Yeni öğe eklendiğinde tetiklenecek olay

  // NEW: Output for custom button clicks
  @Output() cellButtonClick = new EventEmitter<CellButtonClickEvent<T>>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private dialog = inject(MatDialog);
  private toastService = inject(ToastService);
  private datePipe = inject(DatePipe);

  dataSource = new MatTableDataSource<T>([]);
  filterValues: { [key: string]: string } = {}; // Aktif filtre değerlerinin izlenmesi
  totalItems: number = 0;
  pageSize: number = 10;
  currentPage: number = 0;
  isLoading: boolean = false;
  currentSortField: string = '';
  currentSortDirection: string = '';
  isExternalMode: boolean = false; // Flag to determine if using external data source

  /**
   * Check if a column is a button type
   */
  isButtonColumn(column: string): boolean {
    const colDef = this.columnDefinitions.find(def => def.key === column);
    return colDef?.type === 'button' || colDef?.type === 'icon-button';
  }

  /**
   * Get button configuration for a column
   */
  getButtonConfig(column: string): ButtonConfig | undefined {
    const colDef = this.columnDefinitions.find(def => def.key === column);
    return colDef?.buttonConfig;
  }

  /**
   * Handle button click in a cell
   */
  onCellButtonClick(row: T, column: string, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.cellButtonClick.emit({ row, column });
  }

  /**
   * Bir değerin sayısal olup olmadığını kontrol eder
   * @param value Kontrol edilecek değer
   * @returns Sayısal ise true, değilse false
   */
  isNumeric(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    // Değer sayı türündeyse
    if (typeof value === 'number') {
      return true;
    }

    // Değer string ise ve sayıya çevrilebiliyorsa
    if (typeof value === 'string') {
      return !isNaN(Number(value)) && !isNaN(parseFloat(value));
    }

    return false;
  }

  // Bu metod template'deki spread operatörünü kaldırmak için
  getDisplayColumnWithActions(): string[] {
    let columns = [...this.displayedColumns];

    // Eğer sıra numarası gösterilecekse, en başa 'rowNumber' sütununu ekle
    if (this.showRowNumbers) {
      columns = ['rowNumber', ...columns];
    }

    // En sona 'actions' sütununu ekle (sadece en az bir buton gösteriliyorsa)
    if (this.showUpdateButton || this.showDeleteButton) {
      columns.push('actions');
    }

    return columns;
  }

  // Sıra numarası hesaplama metodu
  getRowNumber(index: number): number {
    return this.currentPage * this.pageSize + index + 1;
  }

  /**
   * Handles the click event for the add button.
   * If the parent component has subscribed to the `addClick` output, it emits the event.
   * Otherwise, it executes the default behavior (opening the add/update dialog).
   * @param event The click event object
   */
  onAddButtonClick(event: Event): void {
    event.stopPropagation(); // Prevent event bubbling

    if (this.addClick.observed) {
      this.addClick.emit(); // Let the parent component handle the add action
    } else {
      this.openAddOrUpdateDialog(); // Default action: open dialog to add a new item
    }
  }

  ngOnInit(): void {
    // Determine if we're using external data mode
    this.isExternalMode = !!this.externalDataFetcher || this.externalData !== undefined;

    // Filterablecolumns için filterValues objesini oluştur
    this.filterableColumns.forEach((column) => {
      this.filterValues[column] = '';
    });

    // If external data is directly provided, use it (without fetching)
    if (this.externalData && !this.externalDataFetcher) {
      this.updateDataFromExternalSource(this.externalData, this.externalTotalCount || this.externalData.length);
    } else {
      this.loadData();
    }
  }

  ngAfterViewInit() {
    // Sort olayı için listener ekle
    if (this.sort) {
      this.sort.sortChange.subscribe((sort: Sort) => {
        this.currentPage = 0; // Sıralama değiştiğinde ilk sayfaya dön
        if (this.paginator) {
          this.paginator.pageIndex = 0;
        }
        this.currentSortField = sort.active;
        this.currentSortDirection = sort.direction;
        this.loadData();
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If external data changes directly, update the data source
    if (changes['externalData'] && !changes['externalData'].firstChange) {
      if (this.externalData) {
        this.updateDataFromExternalSource(
          this.externalData,
          this.externalTotalCount || this.externalData.length
        );
      }
    }

    // parentId, useParentId veya parentIdFieldName değiştiğinde veriyi yeniden yükle
    if (
      (changes['parentId'] && this.useParentId) ||
      (changes['useParentId'] && this.useParentId) ||
      (changes['parentIdFieldName'] &&
        this.useParentId &&
        this.parentId !== null)
    ) {
      // İlk sayfa için sayfalayıcıyı sıfırla
      this.currentPage = 0;
      if (this.paginator) {
        this.paginator.pageIndex = 0;
      }

      // Veriyi yeniden yükle
      this.loadData();
    }
  }

  /**
   * Update the data source with external data
   * @param data The data array
   * @param totalCount The total count for pagination
   */
  private updateDataFromExternalSource(data: T[], totalCount: number): void {
    this.dataSource.data = data;
    this.totalItems = totalCount;
    this.isLoading = false;
  }

  /**
   * Sütunlar için filtre dialogu açar
   * @param column Filtre uygulanacak sütun
   */
  openFilterDialog(column: string, event: Event): void {
    event.stopPropagation(); // Sort olayının tetiklenmesini engelle

    // Sütun için mevcut filtre değerini al
    const currentValue = this.filterValues[column] || '';

    // Sütunun görünen adını bul
    const displayName = this.getColumnDisplayName(column);

    // Basit dialog'u aç
    const dialogRef = this.dialog.open(FilterDialogComponent, {
      width: '350px',
      data: {
        column,
        displayName,
        currentValue,
      },
    });

    // Dialog kapandığında sonucu işle
    dialogRef.afterClosed().subscribe((result) => {
      if (result !== null) {
        // null ise iptal edilmiş demektir
        this.filterValues[column] = result;

        // Filtre değiştiğinde ilk sayfaya dön
        this.currentPage = 0;
        if (this.paginator) {
          this.paginator.pageIndex = 0;
        }

        this.loadData();
      }
    });
  }

  /**
   * Belirli bir sütun için filtrenin aktif olup olmadığını kontrol eder
   * @param column Kontrol edilecek sütun
   * @returns Filtre aktif mi
   */
  isFilterActive(column: string): boolean {
    return (
      this.filterValues[column] !== undefined &&
      this.filterValues[column] !== null &&
      this.filterValues[column] !== ''
    );
  }

  /**
   * Tüm filtreleri temizler
   */
  clearAllFilters(): void {
    this.filterableColumns.forEach((column) => {
      this.filterValues[column] = '';
    });

    this.currentPage = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }

    this.loadData();
  }

  /**
   * Aktif filtreler var mı kontrol eder
   * @returns En az 1 aktif filtre varsa true
   */
  hasActiveFilters(): boolean {
    return Object.values(this.filterValues).some(
      (value) => value !== undefined && value !== null && value !== ''
    );
  }

  /**
   * Verileri API'den yükleyen metod
   * Backend'in filtreleme yapısına uygun parametre gönderir
   */
  loadData(): void {
    this.isLoading = true;

    // Parent ID değeri boş ve useParentId aktif ise,
    // API çağrısı yapmadan tabloyu temizle ve uyarı göster
    if (
      this.useParentId &&
      (this.parentId === null || this.parentId === undefined)
    ) {
      this.dataSource.data = [];
      this.totalItems = 0;
      this.isLoading = false;
      return;
    }

    // Temel parametreler
    const params: ExternalDataParams = {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };

    // Üst nesne ID varsa ve kullanılması isteniyorsa ekle
    if (this.useParentId && this.parentId !== null) {
      // Dinamik olarak gönderilen field adını kullan
      params[this.parentIdFieldName] = this.parentId;
    }

    // Sıralama parametresi ekle
    if (this.currentSortField && this.currentSortDirection) {
      params.ordering = `${this.currentSortDirection === 'desc' ? '-' : ''}${this.currentSortField}`;
    } else if (this.sort && this.sort.active) {
      // MatSort'tan sıralama bilgisini al
      params.ordering = `${this.sort.direction === 'desc' ? '-' : ''}${this.sort.active}`;
    }

    // Filtre değerlerini ekle
    Object.keys(this.filterValues).forEach((key) => {
      const value = this.filterValues[key];
      if (value !== undefined && value !== null && value !== '') {
        params[key] = value;
      }
    });

    // Choose the data source strategy based on inputs
    if (this.isExternalMode && this.externalDataFetcher) {
      // Use the external data fetcher function
      this.externalDataFetcher(params).subscribe({
        next: (result: ExternalDataResult<T>) => {
          this.updateDataFromExternalSource(result.results, result.count);
          this.toastService.success(this.translate.instant('GENERIC_TABLE.DATA_LOADED'), this.translate.instant('COMMON.SUCCESS'));
        },
        error: (error) => {
          this.toastService.error(this.translate.instant('GENERIC_TABLE.DATA_LOAD_ERROR'), this.translate.instant('COMMON.WARNING'));
          this.dataSource.data = [];
          this.totalItems = 0;
          this.isLoading = false;
        }
      });
    } else if (!this.isExternalMode && this.service) {
      // Use the service (original behavior)
      this.service.getAll(params).subscribe({
        next: (page: Page<T>) => {
          if (page && 'results' in page && Array.isArray(page.results)) {
            this.dataSource.data = [];
            setTimeout(() => {
              this.dataSource.data = page.results;
              this.totalItems = page.count;
            }, 0);
          } else {
            this.toastService.error(
              this.translate.instant('GENERIC_TABLE.UNEXPECTED_RESPONSE'),
              this.translate.instant('COMMON.WARNING')
            );
            this.dataSource.data = [];
            this.totalItems = 0;
          }
          this.toastService.success(this.translate.instant('GENERIC_TABLE.DATA_LOADED'));
          this.isLoading = false;
        },
        error: (error) => {
          this.toastService.error(this.translate.instant('GENERIC_TABLE.DATA_LOAD_ERROR'));
          this.isLoading = false;
          this.dataSource.data = [];
          this.totalItems = 0;
        },
      });
    } else if (this.externalData && this.externalData.length > 0) {
      this.toastService.success(this.translate.instant('GENERIC_TABLE.DATA_LOADED'))
      this.isLoading = false;
    }
    else {
      // No valid data source
      this.isLoading = false;
      this.dataSource.data = [];
      this.totalItems = 0;
    }
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  // openAddOrUpdateDialog metodunda columnDefinitions dizisinin doğru gönderildiğinden emin olalım
  openAddOrUpdateDialog(row?: T): void {
    // Tabloda gösterilen sütunlara göre dinamik olarak görünür alanları belirle

    if (this.displayedColumns.length === 0) {
      return;
    }

    // Sütun tanımlarımız yoksa bir hata mesajı göster
    if (!this.columnDefinitions || this.columnDefinitions.length === 0) {
      //Basit sütun tanımları oluştur
      this.columnDefinitions = this.displayedColumns
        .filter((col) => col !== 'actions' && col !== 'rowNumber')
        .map((col: string) => ({
          key: col,
          label: this.getColumnDisplayName(col),
          type: this.columnTypes[col] || "text",
          required: true,
        }));
    }

    const dialogRef = this.dialog.open(AddOrUpdateDialogComponent, {
      width: '500px',
      data: {
        row: row, // Düzenleme için mevcut satır verisi (eğer yeni ekleme ise undefined)
        columns: this.columnDefinitions, // Sütun tanımları
        visibleFields: this.displayedColumns.filter(
          (col) => col !== 'actions' && col !== 'rowNumber' && !this.excludeFields.includes(col)
        ), // Dinamik olarak belirlenen alanlar
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (row) {
          // Mevcut öğeyi güncelle
          this.isLoading = true;

          // Check if using external mode or service
          if (this.isExternalMode) {
            // Emit event for external update
            this.externalDataUpdate.emit({ item: row, data: result });
            this.isLoading = false;
          } else if (this.service) {
            // Use the service (original behavior)
            this.service.update((row as any).id, result).subscribe({
              next: (updatedItem) => {
                this.updateItem.emit(updatedItem); // Güncellenmiş nesneyi bildir
                this.toastService.success(
                  this.translate.instant('GENERIC_TABLE.UPDATE_SUCCESS'),
                  this.translate.instant('GENERIC_TABLE.UPDATED')
                );
                this.loadData(); // Tabloyu yenile
                this.isLoading = false;
              },
              error: (error) => {
                this.toastService.error(this.translate.instant('GENERIC_TABLE.ADD_ERROR'), this.translate.instant('GENERIC_TABLE.UPDATE_FAILED'));
                this.isLoading = false;
              },
            });
          }
        } else {
          // Yeni öğe ekle
          this.isLoading = true;

          // Parent ID parametresi kullanılıyorsa, yeni ekleme için de dahil et
          if (this.useParentId && this.parentId) {
            result[this.parentIdFieldName] = this.parentId;
          }

          // Check if using external mode or service
          if (this.isExternalMode) {
            // Emit event for external create
            this.externalDataCreate.emit(result);
            this.toastService.success(this.translate.instant('GENERIC_TABLE.ADD_REQUEST_SENT'));
            this.isLoading = false;
          } else if (this.service) {
            // Use the service (original behavior)
            this.service.create(result).subscribe({
              next: (createdItem) => {
                this.itemAdded.emit(createdItem); // Yeni eklenen öğeyi bildir
                this.toastService.success(this.translate.instant('GENERIC_TABLE.ADDED_SUCCESS'), this.translate.instant('GENERIC_TABLE.ADDED'));
                this.dataSource.data.unshift(createdItem);
                this.isLoading = false;
              },
              error: (error) => {
                this.toastService.error(this.translate.instant('GENERIC_TABLE.ADD_ERROR'), this.translate.instant('GENERIC_TABLE.ADD_FAILED'));
                this.isLoading = false;
              },
            });
          }
        }
      }
    });
  }

  confirmDelete(id: any): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: { message: this.translate.instant('GENERIC_TABLE.DELETE_CONFIRMATION') },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.deleteItem(id);
      }
    });
  }

  deleteItem(id: any): void {
    this.isLoading = true;

    // Check if using external mode or service
    if (this.isExternalMode) {
      // Emit event for external delete
      this.externalDataDelete.emit(id);
      this.rowDeleted.emit(id);

      // Optionally remove the item from the local data source
      let index = this.dataSource.data.findIndex((item: any) => item.id === id);
      if (index !== -1) {
        const newData = [...this.dataSource.data];
        newData.splice(index, 1);
        this.dataSource.data = newData;
      }

      this.toastService.success(this.translate.instant('GENERIC_TABLE.DELETE_REQUEST_SENT'), this.translate.instant('COMMON.INFO'));
      this.isLoading = false;
    } else if (this.service) {
      // Use the service (original behavior)
      this.service.delete(id).subscribe({
        next: () => {
          this.rowDeleted.emit(id);
          let index = this.dataSource.data.findIndex((item: any) => item.id === id);
          if (index !== -1) {
            const newData = [...this.dataSource.data];
            newData.splice(index, 1);
            this.dataSource.data = newData;
          }
          this.toastService.success('Başari ile silindi', this.translate.instant('GENERIC_TABLE.DELETED'));
          this.isLoading = false;
        },
        error: (error) => {
          this.toastService.error(this.translate.instant('GENERIC_TABLE.DELETE_FAILED'), this.translate.instant('COMMON.ERROR'));
          this.isLoading = false;
        },
      });
    } else {
      this.toastService.error(this.translate.instant('GENERIC_TABLE.NO_VALID_RESOURCE'), this.translate.instant('COMMON.ERROR'));
      this.isLoading = false;
    }
  }

  /**
   * İç içe özellik değerlerini alır (örn: "product_type.code")
   * @param obj Ana nesne
   * @param path Nokta notasyonu ile path (ör: "product_type.code")
   * @returns Özellik değeri veya boş string
   */
  getNestedPropertyValue(obj: any, path: string): any {
    if (!obj) return '';

    // Path'i parçalara ayır
    const props = path.split('.');
    let value = obj;

    // Her parça için değeri gezin
    for (const prop of props) {
      // Eğer değer null, undefined veya değer[prop] tanımlanmamışsa, boş string döndür
      if (value === null || value === undefined || value[prop] === undefined) {
        return '';
      }
      value = value[prop];
    }

    return this.formatValue(value, path);
  }

  /**
   * Format value based on column type
   * @param value The value to format
   * @param column The column name
   * @returns Formatted value
   */
  // generic-table.component.ts - formatValue metodunun içine ekle
  formatValue(value: any, column: string): any {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    //  is_completed special format
    if (column === 'is_completed') {
      return value === true || value === 'true' ? this.translate.instant('COMMON.COMPLETED') : this.translate.instant('ORDER.INCOMPLETE_ORDER');
    }

    // Date check
    if (this.columnTypes[column] === 'date') {
      return this.datePipe.transform(value, 'dd/MM/yyyy') || value;
    }

    // Number check
    if (typeof value === 'number') {
      if (value % 1 !== 0) {
        return value.toFixed(2);
      }
    }

    return value;
  }

  /**
   * Status değerini boolean'a çevirir
   */
  isStatusCompleted(row: any, column: string): boolean {
    const value = this.getNestedPropertyValue(row, column);

    // Boolean kontrolü
    if (typeof value === 'boolean') {
      return value;
    }

    // String kontrolü
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    // Diğer truthy değerler
    return !!value;
  }
  // Get the display name for a column
  getColumnDisplayName(column: string): string {
    // "rowNumber" sütunu için özel isim
    if (column === 'rowNumber') {
      return '#';
    }

    // If it's a nested column and we have a display name for it
    if (this.nestedDisplayColumns && this.nestedDisplayColumns[column]) {
      return this.nestedDisplayColumns[column];
    }

    // Otherwise just use the column name with title case
    return column
      .replace(/\./g, ' ')
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Manually update the data source with new data (useful for parent components)
   * @param data Data to set
   * @param totalCount Total count for pagination
   */
  public updateData(data: T[], totalCount?: number): void {
    this.updateDataFromExternalSource(data, totalCount || data.length);
  }

  /**
   * Manually trigger a data refresh
   */
  public refreshData(): void {
    this.loadData();
  }
}
