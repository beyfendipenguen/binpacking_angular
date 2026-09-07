import { Base } from "@app/core/interfaces/base.interface";

/**
 * LoadingConstraint'in company_relations alanında nested dönen özet.
 * Backend: organizations.CompanyRelationAutocompleteSerializer.
 */
export interface LoadingConstraintRelationSummary {
  id: string;
  relation_type: string;
  target_company: {
    id: string;
    company_name: string;
    order_count?: number;
  };
}

/**
 * "9+9", "10+9" gibi iki katmanlı palet yükleme kuralı.
 *
 * type_id/code_id kasıtlı olarak FK değil — products.ProductType.id taşırlar.
 * type_id zorunlu (o satırın "type" alanı referans alınır), code_id opsiyonel
 * (doluysa aynı satırın "code" alanı referans alınır; boşsa kural type_id'nin
 * type'ına ait TÜM code'lara uygulanır).
 */
export interface LoadingConstraint extends Base {
  type_id: string;
  code_id?: string | null;
  /** type_id'nin ProductType.type'ından çözülmüş okunabilir değeri (read-only). */
  type?: string | null;
  /** code_id'nin ProductType.code'undan çözülmüş okunabilir değeri (read-only). */
  code?: string | null;
  first_layer_count: number;
  second_layer_count?: number | null;
  company_relations?: LoadingConstraintRelationSummary[];
  company?: string;
}

export interface LoadingConstraintDto {
  type_id: string;
  code_id?: string | null;
  first_layer_count: number;
  second_layer_count?: number | null;
}
