// ============================================
// Constraint Profile Interface (yeni)
// ============================================

/**
 * RelationConstraintProfile — algoritma kısıtları
 * Backend: logistics.models.RelationConstraintProfile
 */
export interface ConstraintProfile  {
  id:string;
  // ─── Bölüm 1 — temel tolerans ───
  size_tolerance_mm: number;
  depth_short_tolerance_mm: number;
  combination_tolerance_mm: number;
  min_fill_ratio: number;
  max_geometric_ratio: number;

  // ─── Bölüm 2 — simetrik tolerans ───
  check_depth_symmetric: boolean;
  depth_symmetric_tolerance_mm: number;
  check_width_symmetric: boolean;
  width_symmetric_tolerance_mm: number;

  // ─── Bölüm 2 — anchor + flat ───
  anchor_min_full_pallets: number;
  flat_product_height_threshold: number;
  side_product_ids: string[]; // UUID listesi
  enable_loose_remainder_packing?: boolean;
  // ─── UI uyarı (algoritma kullanmıyor) ───
  max_pallet_weight_kg: number | null;

  // ─── Gelecek özellikler (UI disabled, backend hazır) ───
  forbidden_pairs: string[][]; // [[uuid1, uuid2], ...]
  required_pairs: string[][];
  force_top_product_ids: string[];
  force_bottom_product_ids: string[];
  load_order_priorities: Record<string, number>; // {uuid: priority}
}

/**
 * Default değerler — backend ile birebir aynı olmalı
 */
export function createDefaultConstraintProfile(): ConstraintProfile {
  return {
    id:'',
    size_tolerance_mm: 1.0,
    depth_short_tolerance_mm: 200.0,
    combination_tolerance_mm: 0.0,
    min_fill_ratio: 0.0,
    max_geometric_ratio: 2.0,
    check_depth_symmetric: false,
    depth_symmetric_tolerance_mm: 200.0,
    check_width_symmetric: false,
    width_symmetric_tolerance_mm: 100.0,
    anchor_min_full_pallets: 1,
    flat_product_height_threshold: 40.0,
    enable_loose_remainder_packing: false,
    side_product_ids: [],
    max_pallet_weight_kg: null,
    forbidden_pairs: [],
    required_pairs: [],
    force_top_product_ids: [],
    force_bottom_product_ids: [],
    load_order_priorities: {},
  };
}
