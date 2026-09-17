import { Base } from "@app/core/interfaces/base.interface";

/**
 * PalletSelectionRule'ün company_relations alanında nested dönen özet.
 * Backend: organizations.CompanyRelationAutocompleteSerializer.
 */
export interface PalletSelectionRuleRelationSummary {
  id: string;
  relation_type: string;
  target_company: {
    id: string;
    company_name: string;
    order_count?: number;
  };
}

/**
 * Ürünün width/depth aralığına göre palet aramasını belirli bir PalletGroup
 * içine daraltan kural.
 *
 * width_min/width_max ve depth_min/depth_max aralıkları HER İKİ yönde de
 * (normal ve 90° döndürülmüş) test edilir — bkz. backend model docstring'i.
 * Sabit bir değer istenirse min==max girilir.
 *
 * Aynı company_relation'da BİRDEN FAZLA kuralın aralığı KESİŞEBİLİR — bu
 * reddedilmez, backend her ikisinin de pallet_group'unu birleştirip
 * (union) arar. UI'da çakışan aralıklar için sadece bilgilendirme amaçlı
 * uyarı gösterilir (bkz. create-dialog).
 */
export interface PalletSelectionRule extends Base {
  width_min: number;
  width_max: number;
  depth_min: number;
  depth_max: number;
  pallet_group: string;
  /** pallet_group'un adı (read-only, listelemede göstermek için). */
  pallet_group_name?: string | null;
  company_relations?: PalletSelectionRuleRelationSummary[];
  company?: string;
}

export interface PalletSelectionRuleDto {
  width_min: number;
  width_max: number;
  depth_min: number;
  depth_max: number;
  pallet_group: string;
}
