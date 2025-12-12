import { inject } from '@angular/core';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { ProductService } from '@app/features/services/product.service';

export function createProductBulkConfig(): BulkUploadConfig {
  const productService = inject(ProductService);

  return {
    entityName: 'Ürün',
    entityNamePlural: 'Ürünler',
    icon: 'add_shopping_cart',
    templateType: 'product_template',
    templateFileName: 'urun_sablonu.xlsx',
    uploadFn: (file: File) => productService.bulkUpload(file),
    instructions: [
      '1️⃣  Excel şablonunu indirin',
      '2️⃣  Şablonu doldurarak ürünlerinizi ekleyin',
      '3️⃣  Doldurduğunuz dosyayı sisteme yükleyin',
      '4️⃣  Std, Eco, Pre: Ürünün farklı kalitedeki ağırlıklarını temsil eder'
    ],
    acceptedFileTypes: ['.xlsx', '.xls']
  };
}
