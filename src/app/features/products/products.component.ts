import { Component, OnInit, inject } from '@angular/core';
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
    HasPermissionDirective
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  productService = inject(ProductService);
  productBulkConfig: BulkUploadConfig = createProductBulkConfig();

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
      key: 'weight_type.std',
      label: 'Std',
      type: 'number',
      required: true,
      min: 0,
      hint: 'kg'
    },
    {
      key: 'weight_type.eco',
      label: 'Eco',
      type: 'number',
      required: true,
      min: 0,
      hint: 'kg'
    },
    {
      key: 'weight_type.pre',
      label: 'Pre',
      type: 'number',
      required: true,
      min: 0,
      hint: 'kg'
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
  .filter(c => c.type === 'number' || c.key.startsWith('product_type') || c.key.startsWith('dimension') || c.key.startsWith('weight_type'))
  .map(c => c.key);

  notSortableColumns: string[] = ['name'];

  columnTypes: { [key: string]: string } = {
    'created_at': 'date'
  };

  ngOnInit(): void {}
}
