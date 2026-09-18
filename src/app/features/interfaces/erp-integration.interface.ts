/**
 * ERP entegrasyonu (bkz. backend logistics/services/erp_integration/ +
 * organizations.ERPCredential) için frontend tipleri.
 */

export interface ErpSecretsConfigured {
  username: boolean;
  password: boolean;
  api_key: boolean;
}

/** GET organizations/erp-credential/mine/ cevabı. */
export interface ErpCredential {
  id: string | null;
  erp_type: string;
  settings: Record<string, any>;
  is_active: boolean;
  secrets_configured: ErpSecretsConfigured;
  is_configured: boolean;
  created_at?: string;
}

/**
 * PATCH organizations/erp-credential/update-mine/ gövdesi.
 * erp_type BİLEREK yok — backend'de ERPCredentialWriteSerializer'da da yok,
 * hangi connector'ın kullanılacağına admin panelinden karar verilir.
 */
export interface ErpCredentialUpdatePayload {
  settings?: Record<string, any>;
  is_active?: boolean;
  // Boş bırakılırsa mevcut şifreli değer korunur — backend tarafında
  // ERPCredentialWriteSerializer._apply_secrets bu birleştirmeyi yapar.
  secret_username?: string;
  secret_password?: string;
  secret_api_key?: string;
}

/** ERP'den gelen tek bir sipariş özeti (liste ekranı satırı). */
export interface ErpOrderSummary {
  order_number: string;
  customer_name: string;
  customer_code?: string | null;
  date?: string | null;
  status?: string | null;
  /**
   * Backend (erp_list_orders_task) bu siparişin daha önce BAŞARIYLA içeri
   * aktarılıp aktarılmadığını ErpImportedOrder tablosuna bakarak ekler.
   * Sayfa yeniden "Siparişleri Çek" ile yenilense bile, önceden aktarılmış
   * bir sipariş tekrar aktarılabilir gibi görünmesin diye.
   */
  already_imported?: boolean;
  /**
   * En son aktarım denemesi BAŞARISIZ olduysa hata mesajı, hiç denenmediyse
   * veya en son deneme başarılıysa null/undefined. Sayfa yenilenip
   * "Siparişleri Çek" tekrar çalıştırıldığında (component'in bellekteki
   * rowStates'i sıfırlandığında) satırın "başarısız" durumunu DB'den
   * geri yükleyebilmek için — bkz. integration.component.ts fetchOrders().
   */
  last_import_error?: string | null;
  /**
   * already_imported=true ise ve o siparişi oluşturan Order kaydı hâlâ
   * mevcutsa (silinmediyse) dolu gelir — "Siparişe Git" butonu bunu kullanır.
   */
  order_id?: string | null;
}

/** Frontend'de bir satırın anlık aktarım durumu (yerel state). */
export type ErpRowImportState = 'idle' | 'importing' | 'imported' | 'failed';

export interface ErpAsyncQueuedResponse {
  status: string;
  message: string;
  task_id: string;
}

/**
 * Sayfalama YAPABİLEN bir connector'dan gelir (bkz. backend
 * base_connector.py :: last_list_page_info, SanicaConnector.list_orders —
 * GetDataTableWithPagingSQL). total_count/total_pages null/undefined ise
 * (connector sayfalamayı desteklemiyor demektir) integration.component.ts
 * toplamı bilmeden, sadece dönen satır sayısına bakarak ("bu sayfa doluysa
 * muhtemelen sonraki sayfa da var") tahmini bir uzunlukla ilerler.
 */
export interface ErpListPageInfo {
  page: number;
  page_size: number;
  total_count: number | null;
  total_pages: number | null;
}

/** GET logistics/erp/list-orders-status/ cevabı. */
export interface ErpListOrdersStatus {
  state: 'queued' | 'done' | 'error';
  ready: boolean;
  orders?: ErpOrderSummary[];
  page_info?: ErpListPageInfo | null;
  error?: string;
}

/** GET logistics/erp/import-order-status/ cevabı. */
export interface ErpImportOrderStatus {
  state: 'queued' | 'done' | 'error';
  ready: boolean;
  order_id?: string;
  order_name?: string;
  matched_count?: number;
  unmatched_codes?: string[];
  error?: string;
}
