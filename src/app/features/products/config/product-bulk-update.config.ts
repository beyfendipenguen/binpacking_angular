import { inject } from '@angular/core';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { ProductService } from '@app/features/services/product.service';
import { TranslateService } from '@ngx-translate/core';

export function createProductBulkUpdateConfig(): BulkUploadConfig {
  const productService = inject(ProductService);
  const translate = inject(TranslateService);

  return {
    entityName: translate.instant('PRODUCT.PRODUCT'),
    entityNamePlural: translate.instant('PRODUCT.PRODUCTS'),
    icon: 'sync',
    templateType: '',
    templateFileName: '',
    requireTemplateDownload: false,  // direkt upload
    uploadFn: (file: File) => productService.bulkUpdate(file),
    instructions: [
      `1️⃣ ${translate.instant('PRODUCT.BULK_UPDATE_STEP_1')}`,
      `2️⃣ ${translate.instant('PRODUCT.BULK_UPDATE_STEP_2')}`,
      `3️⃣ ${translate.instant('PRODUCT.BULK_UPDATE_STEP_3')}`,
      `4️⃣ ${translate.instant('PRODUCT.BULK_UPDATE_STEP_4')}`,
      `5️⃣ ${translate.instant('PRODUCT.BULK_UPDATE_STEP_5')}`,
    ],
    acceptedFileTypes: ['.xlsx', '.xls']
  };
}
