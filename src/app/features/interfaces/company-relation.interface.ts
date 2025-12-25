import { Company } from "./company.interface";

export enum RelationType {
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier',
  PARTNER = 'partner',
  CONTRACTOR = 'contractor',
  DISTRIBUTOR = 'distributor',
  SUBSIDIARY = 'subsidiary',
  OTHER = 'other'
}

export interface CompanyRelation {
  id?: string;
  target_company: Company;
  relation_type: RelationType;
  relation_type_display: string;
  is_active: boolean;
  notes?: string | null;
  extra_data?: ExtraData | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface ExtraData {
  _schema_version?: string;
  is_multi_pallet?: boolean;
  max_pallet_height?: number;
  truck_weight_limit?: number;
  default_pallet_group_id?: string | null;
  [key: string]: any; // ← BUNU EKLE - Dynamic fields için
}

export interface CompanyRelationDto {
  target_company: Company;
  relation_type: RelationType;
  is_active: boolean;
  notes?: string | null;
  extra_data?: ExtraData | null;
}

// ✅ Translation key'leri döndür (component'te translate edilecek)
export const RELATION_TYPE_KEYS = {
  [RelationType.CUSTOMER]: 'COMPANY_RELATION.TYPE.CUSTOMER',
  [RelationType.SUPPLIER]: 'COMPANY_RELATION.TYPE.SUPPLIER',
  [RelationType.PARTNER]: 'COMPANY_RELATION.TYPE.PARTNER',
  [RelationType.CONTRACTOR]: 'COMPANY_RELATION.TYPE.CONTRACTOR',
  [RelationType.DISTRIBUTOR]: 'COMPANY_RELATION.TYPE.DISTRIBUTOR',
  [RelationType.SUBSIDIARY]: 'COMPANY_RELATION.TYPE.SUBSIDIARY',
  [RelationType.OTHER]: 'COMPANY_RELATION.TYPE.OTHER'
} as const;

// ✅ Translation key döndür
export const getRelationTypeKey = (type: RelationType): string => {
  return RELATION_TYPE_KEYS[type] || 'COMPANY_RELATION.TYPE.UNKNOWN';
};

// ✅ Dropdown için translation key'ler
export const RELATION_TYPE_OPTIONS = [
  { value: RelationType.CUSTOMER, labelKey: 'COMPANY_RELATION.TYPE.CUSTOMER' },
  { value: RelationType.SUPPLIER, labelKey: 'COMPANY_RELATION.TYPE.SUPPLIER' },
  { value: RelationType.PARTNER, labelKey: 'COMPANY_RELATION.TYPE.PARTNER' },
  { value: RelationType.CONTRACTOR, labelKey: 'COMPANY_RELATION.TYPE.CONTRACTOR' },
  { value: RelationType.DISTRIBUTOR, labelKey: 'COMPANY_RELATION.TYPE.DISTRIBUTOR' },
  { value: RelationType.SUBSIDIARY, labelKey: 'COMPANY_RELATION.TYPE.SUBSIDIARY' },
  { value: RelationType.OTHER, labelKey: 'COMPANY_RELATION.TYPE.OTHER' }
];

export const createDefaultCompanyRelation = (): Partial<CompanyRelationDto> => {
  return {
    relation_type: RelationType.CUSTOMER,
    is_active: true,
    notes: '',
    extra_data: {
      _schema_version: '1.0',
      is_multi_pallet: false,
      max_pallet_height: 2400,
      truck_weight_limit: 25000,
      default_pallet_group_id: null
    }
  };
};
