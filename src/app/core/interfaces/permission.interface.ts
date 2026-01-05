// Mevcut IPermission'ı kullanıyoruz (değişiklik yok)
export interface IPermission {
    id: number;
    name: string;
    codename: string;
    content_type: {
        id: number;
        app_label: string;
        model: string;
    }
}

export interface IRequiredPermission {
    id: number;
    name: string;
    codename: string;
    content_type: {
        id: number;
        app_label: string;
        model: string;
    }
}

export type PermissionType = string;

export const PERMISSION_FORMAT_REGEX = /^[a-z0-9_]+\.[a-z0-9_]+$/;

// ===== YENİ EKLENENLER =====

export interface GroupProfile {
  id: number;
  type: 'global' | 'custom' | 'system';
  company?: {
    id: number;
    company_name: string;
  };
}

export interface IGroup {
  id: number;
  name: string;
  permissions: number[]; // Permission ID'leri
  group_profile: GroupProfile | null;
  annotated_member_count?: number;
}

// Permission'ları app'lere göre gruplamak için
export interface PermissionGroup {
  app_label: string;
  app_name: string;
  permissions: IPermission[]; // Mevcut IPermission kullanıyoruz
}
