import { inject } from '@angular/core';
import { PalletService } from '@app/features/services/pallet.service';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export function createPalletBulkConfig(): BulkUploadConfig {
  const palletService = inject(PalletService);
  const translate = inject(TranslateService)
  return {
    entityName: translate.instant('PALLET.PALLET'),
    entityNamePlural: translate.instant('PALLET.PALLETS'),
    icon: 'view_module',
    templateType: 'pallet_template',
    templateFileName: 'palet_sablonu.xlsx',
    uploadFn: (file: File) => palletService.bulkUpload(file),
    instructions: [
      `1️⃣  ${translate.instant('PALLET.DOWNLOAD_TEMPLATE')}`,
      `2️⃣  ${translate.instant('PALLET.FILL_TEMPLATE')}`,
      `3️⃣  ${translate.instant('PALLET.UPLOAD_FILE')}`,
    ],
    acceptedFileTypes: ['.xlsx', '.xls']
  };
}
