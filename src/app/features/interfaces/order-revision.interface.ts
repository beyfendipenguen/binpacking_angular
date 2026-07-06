// features/interfaces/order-revision.interface.ts
import { Base } from '@core/interfaces/base.interface';

/** Diff içindeki tek satır — added/removed'da count, changed'da old/new alanları dolu gelir */
export interface RevisionDiffItem {
  code: string;
  count?: number;        // added / removed
  old_count?: number;    // changed (adet değiştiyse)
  new_count?: number;
  old_price?: string;    // changed (fiyat değiştiyse)
  new_price?: string;
}

export interface RevisionDiff {
  added: RevisionDiffItem[];
  removed: RevisionDiffItem[];
  changed: RevisionDiffItem[];
}

export interface RevisionSnapshotRow {
  product_id: string;
  code: string;
  count: number;
  unit_price: string;
}

export type RevisionSource = 'initial' | 'manual' | 'bulk_upload';

export interface OrderRevision extends Base {
  version: number;                 // her capture'da artan iç sayaç
  rev_no: number;                  // Order.name'deki Rev numarası
  order_name: string;              // o anki sipariş adı (örn. THER.3.Rev1)
  source: RevisionSource;
  snapshot: RevisionSnapshotRow[];
  diff: RevisionDiff | null;       // bir önceki version'a göre (adım adım)
  rev_diff: RevisionDiff | null;   // bir önceki Rev'in son haline göre (müşteriye gösterilecek)
}

// ---- mode=summary yanıtı ----
export type SummaryRowStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface RevisionSummaryRow {
  code: string;
  first_count: number;
  last_count: number;
  status: SummaryRowStatus;
}

export interface RevisionSummary {
  first: { order_name: string; created_at: string } | null;
  last: { order_name: string; created_at: string } | null;
  rows: RevisionSummaryRow[];
  totals: { first_total: number; last_total: number } | null;
}