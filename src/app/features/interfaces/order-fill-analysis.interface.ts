// features/interfaces/order-fill-analysis.interface.ts
// Backend: orders/services/fill_analysis_service.py (OrderFillAnalysis.result)

export interface FillAnalysisProduct {
  id: string;
  name: string;
  barcode: string;
  type_name: string;
}

/** Yarım paleti tamamlamak için eklenecek ürün */
export interface FillAnalysisPartialAddition {
  package_id: string;
  package_name: string;
  product: FillAnalysisProduct;
  add_count: number;
  add_weight_kg: number;
  fill_before_pct: number;
  fill_after_pct: number;
  capped_by: 'weight' | null;
}

/** Tırda kalan boşluğa eklenecek tek tipli tam paletler */
export interface FillAnalysisNewPallet {
  product: FillAnalysisProduct;
  pallet: { id: string; name: string; width_mm: number; depth_mm: number };
  pallets: number;
  units_per_pallet: number;
  units_total: number;
  weight_kg: number;
}

export interface FillAnalysisMetrics {
  weight_kg: number;
  weight_pct: number;
  length_used_mm: number;
  length_used_pct: number;
  free_length_mm: number;
  pallet_count: number;
  excess_kg?: number;
}

export interface FillAnalysisScenario {
  type: 'within_limit' | 'over_limit';
  partial_pallet_additions: FillAnalysisPartialAddition[];
  new_pallets: FillAnalysisNewPallet[];
  result: FillAnalysisMetrics;
}

export interface FillAnalysisResult {
  version: number;
  truck: {
    length_mm: number;
    width_mm: number;
    height_mm: number;
    weight_limit_kg: number;
    max_pallet_height_mm: number;
  };
  current: Omit<FillAnalysisMetrics, 'excess_kg'>;
  partial_pallets: { package_id: string; package_name: string; fill_pct: number }[];
  scenarios: FillAnalysisScenario[];
  baseline_ok: boolean;
  truncated: boolean;
  shipment_number?: number;
}

export interface OrderFillAnalysis {
  id: string;
  order: string;
  shipment_number: number;
  has_suggestions: boolean;
  result: FillAnalysisResult;
  created_at: string;
  updated_at: string;
}
