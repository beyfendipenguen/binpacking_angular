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

  // Backend'den nested Company objesi gelecek
  target_company: Company;

  // İlişki türü
  relation_type: RelationType;

  // İlişki türü görünümü
  relation_type_display: string;

  // İlişkinin aktif olup olmadığı
  is_active: boolean;

  // İlişki hakkında notlar
  notes?: string | null;

  // İlişkiye özel ek bilgiler (settings)
  extra_data?: ExtraData | null;

  // Meta-veriler
  created_at?: Date;
  updated_at?: Date;
}

// Extra Data yapısı
export interface ExtraData {
  _schema_version?: string;
  is_multi_pallet?: boolean;
  max_pallet_height?: number;
  truck_weight_limit?: number;
  default_pallet_group_id?: string | null;
}

// Create/Update için DTO
export interface CompanyRelationDto {
  target_company: Company; // UUID
  relation_type: RelationType;
  is_active: boolean;
  notes?: string | null;
  extra_data?: ExtraData | null;
}

// İlişki türlerinin görünür isimlerini getiren yardımcı fonksiyon
export const getRelationTypeLabel = (type: RelationType): string => {
  const labels = {
    [RelationType.CUSTOMER]: 'Müşteri',
    [RelationType.SUPPLIER]: 'Tedarikçi',
    [RelationType.PARTNER]: 'İş Ortağı',
    [RelationType.CONTRACTOR]: 'Yüklenici',
    [RelationType.DISTRIBUTOR]: 'Distribütör',
    [RelationType.SUBSIDIARY]: 'Bağlı Kuruluş',
    [RelationType.OTHER]: 'Diğer'
  };
  return labels[type] || 'Bilinmeyen İlişki Türü';
};

// Relation types için dropdown options
export const RELATION_TYPE_OPTIONS = [
  { value: RelationType.CUSTOMER, label: 'Müşteri' },
  { value: RelationType.SUPPLIER, label: 'Tedarikçi' },
  { value: RelationType.PARTNER, label: 'İş Ortağı' },
  { value: RelationType.CONTRACTOR, label: 'Yüklenici' },
  { value: RelationType.DISTRIBUTOR, label: 'Distribütör' },
  { value: RelationType.SUBSIDIARY, label: 'Bağlı Kuruluş' },
  { value: RelationType.OTHER, label: 'Diğer' }
];

// Yeni bir CompanyRelation oluşturmak için varsayılan değerler
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
