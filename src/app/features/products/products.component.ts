import { Component, OnInit, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GenericTableComponent } from '@shared/generic-table/generic-table.component';
import { ProductService } from '../services/product.service';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { createProductBulkConfig } from './config/product-bulk.config';
import { BulkUploadButtonDirective } from '@app/shared/bulk-upload-dialog/bulk-upload-button.directive';

@Component({
  selector: 'app-products',
  imports: [CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule,
    BulkUploadButtonDirective],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {


  private translate = inject(TranslateService);
  // Servis enjeksiyonları
  productService = inject(ProductService);
  productBulkConfig: BulkUploadConfig = createProductBulkConfig();

  // Loading durumu
  isLoading = false;
  selectedOrderId: string | null = null;

  // API'den dönen verilerde product_type, dimension ve weight_type doğrudan
  // nesne olarak döndüğü için kolonları değişiyoruz
  displayedColumns: string[] = [
    'name',
    'product_type.code',
    'product_type.type',
    'dimension.width',
    'dimension.height',
    'dimension.depth',
    'weight_type.std',
    'weight_type.eco',
    'weight_type.pre'
  ];

  // Filtrelenebilen alanlar
  filterableColumns: string[] = [
    'name',
    'product_type.code',
    'product_type.type',
    'dimension.width',
    'dimension.height',
    'dimension.depth',
    'weight_type.std',
    'weight_type.eco',
    'weight_type.pre'
  ];

  // İlişkili nesne sütunları için özel görüntüleme ayarları
  nestedDisplayColumns: { [key: string]: string } = {
    'name': this.translate.instant('DIMENSIONS.PRODUCT_NAME'),
    'product_type.code': this.translate.instant('DIMENSIONS.PRODUCT_CODE'),
    'product_type.type': this.translate.instant('DIMENSIONS.PRODUCT_TYPE'),
    'dimension.width': this.translate.instant('DIMENSIONS.WIDTH'),
    'dimension.height': this.translate.instant('DIMENSIONS.HEIGHT'),
    'dimension.depth': this.translate.instant('DIMENSIONS.DEPTH'),
    'weight_type.std': 'Std',
    'weight_type.eco': 'Eco',
    'weight_type.pre': 'Pre'
  };

  ngOnInit(): void {

  }
}
