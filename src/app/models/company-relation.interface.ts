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
  id?: number;

  // İlişkinin başlangıç noktası olan şirket (kaynak şirket)
  source_company: string;

  // İlişkinin hedef şirketi
  target_company: string;

  // İlişkinin başlangıç noktası olan şirketin adı
  source_company_name: string;

  target_company_country_name: string;

  // İlişkinin hedef şirketinin adı
  target_company_name: string;

  // İlişki türü
  relation_type: RelationType;

  // iliski turu gorunumu
  relation_type_display: string;

  // İlişkinin aktif olup olmadığı
  is_active: boolean;

  // İlişkinin başlangıç tarihi
  start_date: Date;

  // İlişkinin bitiş tarihi (opsiyonel)
  end_date?: Date | null;

  // Ödeme vadesi (gün cinsinden)
  payment_term: number;

  // Kredi limiti (opsiyonel)
  credit_limit?: number | null;

  // Varsayılan tedarikçi/müşteri mi?
  is_default: boolean;

  // İlişki hakkında notlar
  notes?: string | null;

  // İlişkiye özel ek bilgiler
  extra_data?: any | null;

  // Meta-veriler
  created_at?: Date;
  updated_at?: Date;
  created_by?: number | null;
  updated_by?: number | null;
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

// Yeni bir CompanyRelation oluşturmak için varsayılan değerler
export const createDefaultCompanyRelation = (): Partial<CompanyRelation> => {
  return {
    relation_type: RelationType.OTHER,
    is_active: true,
    payment_term: 30,
    is_default: false,
    start_date: new Date()
  };
};
