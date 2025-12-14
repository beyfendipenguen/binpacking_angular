import { inject } from '@angular/core';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { ProductService } from '@app/features/services/product.service';
import { TranslateService } from '@ngx-translate/core';

export function createProductBulkConfig(): BulkUploadConfig {
  const productService = inject(ProductService);
  const translate = inject(TranslateService)

  return {
    entityName: translate.instant('PRODUCT.PRODUCT'),
    entityNamePlural: translate.instant('PRODUCT.PRODUCTS'),
    icon: 'add_shopping_cart',
    templateType: 'product_template',
    templateFileName: 'urun_sablonu.xlsx',
    uploadFn: (file: File) => productService.bulkUpload(file),
    instructions: [
      `1️⃣ ${translate.instant('PRODUCT.DOWNLOAD_TEMPLATE')}`,
      `2️⃣ ${translate.instant('PRODUCT.FILL_TEMPLATE')}`,
      `3️⃣ ${translate.instant('PRODUCT.UPLOAD_FILE')}`,
      `4️⃣ Std, Eco, Pre: ${translate.instant('PRODUCT.WEIGHT_INFO')}`
    ],
    acceptedFileTypes: ['.xlsx', '.xls']
  };
}
