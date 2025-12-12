import { Observable } from 'rxjs';

export interface BulkUploadConfig {
  // Entity bilgileri
  entityName: string;              // 'Ürün', 'Müşteri', vb.
  entityNamePlural: string;        // 'Ürünler', 'Müşteriler', vb.

  // Icon
  icon: string;                    // 'add_shopping_cart', 'person_add', vb.

  // Template bilgileri
  templateType: string;            // 'product_template', 'customer_template', vb.
  templateFileName: string;        // 'urun_sablonu.xlsx', 'musteri_sablonu.xlsx'

  // Upload endpoint'i çağıracak servis metodu
  uploadFn: (file: File) => Observable<BulkUploadResponse>;

  // Talimatlar (opsiyonel)
  instructions?: string[];

  // Kabul edilen dosya tipleri
  acceptedFileTypes?: string[];    // default: ['.xlsx', '.xls']
}

export interface BulkUploadResponse {
  total_rows: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: BulkUploadError[];
  success_details: BulkUploadSuccess[];
}

export interface BulkUploadError {
  row: number;
  message: string;
}

export interface BulkUploadSuccess {
  row: number;
  message: string;
}
