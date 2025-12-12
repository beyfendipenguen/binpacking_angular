import { inject } from '@angular/core';
import { PalletService } from '@app/features/services/pallet.service';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';

export function createPalletBulkConfig(): BulkUploadConfig {
  const palletService = inject(PalletService);

  return {
    entityName: 'Palet',
    entityNamePlural: 'Paletler',
    icon: 'view_module',
    templateType: 'pallet_template',
    templateFileName: 'palet_sablonu.xlsx',
    uploadFn: (file: File) => palletService.bulkUpload(file),
    instructions: [
      '1️⃣  Excel şablonunu indirin',
      '2️⃣  Şablonu doldurarak paletlerinizi ekleyin',
      '3️⃣  Doldurduğunuz dosyayı sisteme yükleyin',
    ],
    acceptedFileTypes: ['.xlsx', '.xls']
  };
}
