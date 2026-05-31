import { Validators } from '@angular/forms';

export interface ConstraintFieldConfig {
  key: string;
  label: string; // translation key
  type: 'number' | 'string' | 'boolean' | 'select' | 'multi-product' | 'disabled-placeholder';
  icon: string;
  group: string; // grup başlığı (translation key)
  placeholder?: string;
  suffix?: string;
  hint?: string;
  validators?: any[];
  disabled?: boolean; // gelecek özellikler için
  helpText?: string; // disabled alanlar için açıklama
  detailedInfo?: string;
}

export const CONSTRAINT_FIELDS: ConstraintFieldConfig[] = [
  // ─── Grup 1: Tolerans Ayarları ───
  {
    key: 'size_tolerance_mm',
    label: 'CONSTRAINT.SIZE_TOLERANCE',
    type: 'number',
    icon: 'straighten',
    group: 'CONSTRAINT.GROUP_TOLERANCE',
    suffix: 'mm',
    hint: 'CONSTRAINT.SIZE_TOLERANCE_HINT',
    detailedInfo: 'CONSTRAINT.SIZE_TOLERANCE_DETAIL',
    validators: [Validators.min(0.01)],
  },
  {
    key: 'depth_short_tolerance_mm',
    label: 'CONSTRAINT.DEPTH_SHORT_TOLERANCE',
    type: 'number',
    icon: 'compress',
    group: 'CONSTRAINT.GROUP_TOLERANCE',
    suffix: 'mm',
    hint: 'CONSTRAINT.DEPTH_SHORT_TOLERANCE_HINT',
    detailedInfo: 'CONSTRAINT.DEPTH_SHORT_TOLERANCE_DETAIL',
    validators: [Validators.min(0)],
  },
  {
    key: 'combination_tolerance_mm',
    label: 'CONSTRAINT.COMBINATION_TOLERANCE',
    type: 'number',
    icon: 'merge_type',
    group: 'CONSTRAINT.GROUP_TOLERANCE',
    suffix: 'mm',
    hint: 'CONSTRAINT.COMBINATION_TOLERANCE_HINT',
    detailedInfo: 'CONSTRAINT.COMBINATION_TOLERANCE_DETAIL',
    validators: [Validators.min(0)],
  },
  {
    key: 'min_fill_ratio',
    label: 'CONSTRAINT.MIN_FILL_RATIO',
    type: 'number',
    icon: 'percent',
    group: 'CONSTRAINT.GROUP_TOLERANCE',
    suffix: '%',
    hint: 'CONSTRAINT.MIN_FILL_RATIO_HINT',
    detailedInfo: 'CONSTRAINT.MIN_FILL_RATIO_DETAIL',
    validators: [Validators.min(0), Validators.max(100)],
  },
  {
    key: 'pallet_width_margin_mm',
    label: 'CONSTRAINT.PALLET_WIDTH_MARGIN',
    type: 'number',
    icon: 'swap_horiz',
    group: 'CONSTRAINT.GROUP_PALLET_TOLERANCE',
    suffix: 'mm',
    hint: 'CONSTRAINT.PALLET_WIDTH_MARGIN_HINT',
    detailedInfo: 'CONSTRAINT.PALLET_WIDTH_MARGIN_DETAIL',
    validators: [Validators.min(0)],
  },
  {
    key: 'pallet_depth_margin_mm',
    label: 'CONSTRAINT.PALLET_DEPTH_MARGIN',
    type: 'number',
    icon: 'swap_vert',
    group: 'CONSTRAINT.GROUP_PALLET_TOLERANCE',
    suffix: 'mm',
    hint: 'CONSTRAINT.PALLET_DEPTH_MARGIN_HINT',
    detailedInfo: 'CONSTRAINT.PALLET_DEPTH_MARGIN_DETAIL',
    validators: [Validators.min(0)],
  },

  // ─── Grup 2: Simetrik Tolerans ───
  {
    key: 'check_depth_symmetric',
    label: 'CONSTRAINT.CHECK_DEPTH_SYMMETRIC',
    type: 'boolean',
    icon: 'compare_arrows',
    group: 'CONSTRAINT.GROUP_SYMMETRIC',
    hint: 'CONSTRAINT.CHECK_DEPTH_SYMMETRIC_HINT',
    detailedInfo: 'CONSTRAINT.CHECK_DEPTH_SYMMETRIC_DETAIL',
  },
  {
    key: 'depth_symmetric_tolerance_mm',
    label: 'CONSTRAINT.DEPTH_SYMMETRIC_TOLERANCE',
    type: 'number',
    icon: 'swap_horiz',
    group: 'CONSTRAINT.GROUP_SYMMETRIC',
    suffix: 'mm',
    detailedInfo: 'CONSTRAINT.DEPTH_SYMMETRIC_TOLERANCE_DETAIL',
    validators: [Validators.min(0)],
  },
  {
    key: 'check_width_symmetric',
    label: 'CONSTRAINT.CHECK_WIDTH_SYMMETRIC',
    type: 'boolean',
    icon: 'compare_arrows',
    group: 'CONSTRAINT.GROUP_SYMMETRIC',
    detailedInfo: 'CONSTRAINT.CHECK_WIDTH_SYMMETRIC_DETAIL',
    hint: 'CONSTRAINT.CHECK_WIDTH_SYMMETRIC_HINT',
  },
  {
    key: 'width_symmetric_tolerance_mm',
    label: 'CONSTRAINT.WIDTH_SYMMETRIC_TOLERANCE',
    type: 'number',
    icon: 'swap_horiz',
    group: 'CONSTRAINT.GROUP_SYMMETRIC',
    suffix: 'mm',
    detailedInfo: 'CONSTRAINT.WIDTH_SYMMETRIC_TOLERANCE_DETAIL',
    validators: [Validators.min(0)],
  },

  // ─── Grup 3: Geometric Fit ───
  {
    key: 'max_geometric_ratio',
    label: 'CONSTRAINT.MAX_GEOMETRIC_RATIO',
    type: 'number',
    icon: 'calculate',
    group: 'CONSTRAINT.GROUP_GEOMETRIC',
    hint: 'CONSTRAINT.MAX_GEOMETRIC_RATIO_HINT',
    detailedInfo: 'CONSTRAINT.MAX_GEOMETRIC_RATIO_DETAIL',
    validators: [Validators.min(1.0)],
  },

  // ─── Grup 4: Anchor ───
  {
    key: 'anchor_min_full_pallets',
    label: 'CONSTRAINT.ANCHOR_MIN_FULL_PALLETS',
    type: 'number',
    icon: 'inventory_2',
    group: 'CONSTRAINT.GROUP_ANCHOR',
    hint: 'CONSTRAINT.ANCHOR_MIN_FULL_PALLETS_HINT',
    detailedInfo: 'CONSTRAINT.ANCHOR_MIN_FULL_PALLETS_DETAIL',
    validators: [Validators.min(1)],
  },

  // ─── Grup 5: Yan Ürünler (FLAT) ───
  {
    key: 'flat_product_height_threshold',
    label: 'CONSTRAINT.FLAT_HEIGHT_THRESHOLD',
    type: 'number',
    icon: 'height',
    group: 'CONSTRAINT.GROUP_FLAT',
    suffix: 'mm',
    hint: 'CONSTRAINT.FLAT_HEIGHT_THRESHOLD_HINT',
    detailedInfo: 'CONSTRAINT.FLAT_HEIGHT_THRESHOLD_DETAIL',
    validators: [Validators.min(0.01)],
  },
  {
    key: 'side_product_ids',
    label: 'CONSTRAINT.SIDE_PRODUCTS',
    type: 'multi-product',
    icon: 'category',
    group: 'CONSTRAINT.GROUP_FLAT',
    hint: 'CONSTRAINT.SIDE_PRODUCTS_HINT',
    detailedInfo: 'CONSTRAINT.SIDE_PRODUCTS_DETAIL',
  },
  {
    key: 'enable_loose_remainder_packing',
    type: 'boolean',
    icon: 'auto_awesome_mosaic',
    label: 'CONSTRAINT.ENABLE_LOOSE_REMAINDER_PACKING',
    hint: 'CONSTRAINT.ENABLE_LOOSE_REMAINDER_PACKING_HINT',
    detailedInfo: 'CONSTRAINT.ENABLE_LOOSE_REMAINDER_PACKING_DETAIL',
    group: 'CONSTRAINT.GROUP_REMAINDER'
  },
  // ─── Grup 6: Ağırlık Uyarısı ───
  {
    key: 'max_pallet_weight_kg',
    label: 'CONSTRAINT.MAX_PALLET_WEIGHT',
    type: 'number',
    icon: 'fitness_center',
    group: 'CONSTRAINT.GROUP_WEIGHT',
    suffix: 'kg',
    hint: 'CONSTRAINT.MAX_PALLET_WEIGHT_HINT',
    validators: [Validators.min(0)],
    detailedInfo: 'CONSTRAINT.MAX_PALLET_WEIGHT_DETAIL',
  },

  // ─── Grup 7: Gelecek Özellikler (disabled) ───
  {
    key: 'forbidden_pairs',
    label: 'CONSTRAINT.FORBIDDEN_PAIRS',
    type: 'disabled-placeholder',
    icon: 'block',
    group: 'CONSTRAINT.GROUP_FUTURE',
    disabled: true,
    helpText: 'CONSTRAINT.FORBIDDEN_PAIRS_COMING_SOON',
    detailedInfo: 'CONSTRAINT.FORBIDDEN_PAIRS_COMING_SOON_DETAIL',
  },
  {
    key: 'required_pairs',
    label: 'CONSTRAINT.REQUIRED_PAIRS',
    type: 'disabled-placeholder',
    icon: 'link',
    group: 'CONSTRAINT.GROUP_FUTURE',
    disabled: true,
    helpText: 'CONSTRAINT.REQUIRED_PAIRS_COMING_SOON',
    detailedInfo: 'CONSTRAINT.REQUIRED_PAIRS_COMING_SOON_DETAIL',
  },
  {
    key: 'force_top_product_ids',
    label: 'CONSTRAINT.FORCE_TOP_PRODUCTS',
    type: 'disabled-placeholder',
    icon: 'vertical_align_top',
    group: 'CONSTRAINT.GROUP_FUTURE',
    disabled: true,
    helpText: 'CONSTRAINT.FORCE_TOP_COMING_SOON',
    detailedInfo: 'CONSTRAINT.FORCE_TOP_COMING_SOON_DETAIL',
  },
  {
    key: 'force_bottom_product_ids',
    label: 'CONSTRAINT.FORCE_BOTTOM_PRODUCTS',
    type: 'disabled-placeholder',
    icon: 'vertical_align_bottom',
    group: 'CONSTRAINT.GROUP_FUTURE',
    disabled: true,
    helpText: 'CONSTRAINT.FORCE_BOTTOM_COMING_SOON',
    detailedInfo: 'CONSTRAINT.FORCE_BOTTOM_COMING_SOON_DETAIL',
  },
  {
    key: 'load_order_priorities',
    label: 'CONSTRAINT.LOAD_ORDER_PRIORITIES',
    type: 'disabled-placeholder',
    icon: 'reorder',
    group: 'CONSTRAINT.GROUP_FUTURE',
    disabled: true,
    helpText: 'CONSTRAINT.LOAD_ORDER_COMING_SOON',
    detailedInfo: 'CONSTRAINT.LOAD_ORDER_COMING_SOON_DETAIL',
  },
];
