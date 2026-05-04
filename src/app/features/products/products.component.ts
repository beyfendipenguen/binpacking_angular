import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GenericTableComponent } from '@shared/generic-table/generic-table.component';
import { ProductService } from '../services/product.service';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { createProductBulkConfig } from './config/product-bulk.config';
import { BulkUploadButtonDirective } from '@app/shared/bulk-upload-dialog/bulk-upload-button.directive';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { ColumnDefinition } from '@app/shared/generic-table/interfaces/column-definition.interface';
import { MatDialog } from '@angular/material/dialog';
import { Product } from '../interfaces/product.interface';
import { ProductDialogComponent } from './dialogs/product-add-dialog/product-dialog.component';
import { ToastService } from '@app/core/services/toast.service';
import { MatMenuModule } from '@angular/material/menu';
import { createProductBulkUpdateConfig } from './config/product-bulk-update.config';
import { WeightCategoryDialogComponent } from './dialogs/weight-category-dialog/weight-category-dialog.component';

@Component({
  selector: 'app-products',
  imports: [
    CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule,
    BulkUploadButtonDirective,
    TranslateModule,
    DisableAuthDirective,
    MatMenuModule,
    HasPermissionDirective
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  productService = inject(ProductService);
  productBulkConfig: BulkUploadConfig = createProductBulkConfig();
  productBulkUpdateConfig: BulkUploadConfig = createProductBulkUpdateConfig();
  private dialog = inject(MatDialog);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  isExporting = false;
  isBulkUpdating = false;
  activeFilterParams: { [key: string]: string } = {};

  @ViewChild(GenericTableComponent) genericTable!: GenericTableComponent<any>;

  isLoading = false;

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'type_name',
      label: 'DIMENSIONS.PRODUCT_NAME',
      type: 'text',
      required: true,
      maxLength: 255
    },
    {
      key: 'name',
      label: 'DIMENSIONS.PRODUCT_SHORT_NAME',
      type: 'text',
      required: true,
      maxLength: 100
    },
    {
      key: 'product_type.type',
      label: 'DIMENSIONS.PRODUCT_TYPE',
      type: 'text',
      required: true
    },
    {
      key: 'product_type.code',
      label: 'DIMENSIONS.PRODUCT_CODE',
      type: 'text',
      required: true,
      maxLength: 50
    },
    {
      key: 'dimension.width',
      label: 'DIMENSIONS.WIDTH',
      type: 'number',
      required: true,
      min: 0,
      max: 20000,
      hint: 'mm'
    },
    {
      key: 'dimension.depth',
      label: 'DIMENSIONS.DEPTH',
      type: 'number',
      required: true,
      min: 0,
      max: 20000,
      hint: 'mm'
    },
    {
      key: 'dimension.height',
      label: 'DIMENSIONS.HEIGHT',
      type: 'number',
      required: true,
      min: 0,
      max: 20000,
      hint: 'mm'
    },
    {
      key: 'weights',
      label: 'DIMENSIONS.WEIGHTS',
      type: 'weights',
      visible: true,
      required: false
    },
    {
      key: 'created_by',
      label: 'COMMON.USER',
      type: 'text',
      visible: false  // sadece görüntüleme, form'da çıkmasın
    },
    {
      key: 'created_at',
      label: 'ORDER.CREATION_DATE',
      type: 'date',
      visible: false  // sadece görüntüleme, form'da çıkmasın
    }
  ];

  // Table'a geçilecek türetilmiş alanlar — columnDefinitions'tan otomatik
  displayedColumns: string[] = this.columnDefinitions.map(c => c.key);

  filterableColumns: string[] = this.columnDefinitions
    .filter(c => c.type === 'number' || c.key.startsWith('product_type') || c.key.startsWith('dimension'))
    .map(c => c.key);

  notSortableColumns: string[] = ['name'];

  columnTypes: { [key: string]: string } = {
    'created_at': 'date',
    'weights':'weights'
  };

  ngOnInit(): void { }

  openWeightCategoryDialog(): void {
    this.dialog.open(WeightCategoryDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      disableClose: false,
    });
  }

  onFilterChange(params: { [key: string]: string }): void {
    this.activeFilterParams = params;
  }

  // Ürün ekle/güncelle dialog
  openProductDialog(product?: Product): void {
    const dialogRef = this.dialog.open(ProductDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      data: { product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      if (product) {
        this.productService.update(product.id, result).subscribe({
          next: () => {
            this.toastService.success(this.translate.instant('PRODUCT.UPDATE_SUCCESS'));
            this.genericTable?.refreshData();
          },
          error: () => this.toastService.error(this.translate.instant('PRODUCT.UPDATE_ERROR'))
        });
      } else {
        this.productService.create(result).subscribe({
          next: () => {
            this.toastService.success(this.translate.instant('PRODUCT.CREATE_SUCCESS'));
            this.genericTable?.refreshData();
          },
          error: (err) => {
            const message = err?.error?.errors?.[0]?.message
              ?? this.translate.instant('PRODUCT.CREATE_ERROR');
            this.toastService.error(message);
          }
        });
      }
    });
  }

  // Filtrelenmiş ürünleri Excel olarak indir
  exportProducts(): void {
    if (this.isExporting) return;
    this.isExporting = true;

    const filterParams: { [key: string]: string } = {};
    if (this.genericTable?.filterValues) {
      Object.entries(this.genericTable.filterValues).forEach(([k, v]) => {
        if (v) filterParams[k] = v;
      });
    }

    this.productService.exportProducts(filterParams).subscribe({
      next: () => {
        this.isExporting = false;
        this.toastService.success(this.translate.instant('PRODUCT.EXPORT_STARTED'));
      },
      error: (err) => {
        console.error('Export error:', err);
        this.isExporting = false;
        this.toastService.error(this.translate.instant('PRODUCT.EXPORT_ERROR'));
      }
    });
  }

  // Bulk update — dosya seç ve yükle
  onBulkUpdateFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.isBulkUpdating = true;

    this.productService.bulkUpdate(file).subscribe({
      next: (results) => {
        this.isBulkUpdating = false;
        this.toastService.success(
          this.translate.instant('PRODUCT.BULK_UPDATE_SUCCESS', {
            successful: results.successful,
            failed: results.failed
          })
        );
        this.genericTable?.refreshData();
        // Input'u sıfırla
        input.value = '';
      },
      error: (err) => {
        this.isBulkUpdating = false;
        this.toastService.error(this.translate.instant('PRODUCT.BULK_UPDATE_ERROR'));
        input.value = '';
      }
    });
  }
}
