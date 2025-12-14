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

// String'e bir 'alias' (takma ad) veriyoruz.
// İleride bunu 'core.add_order' | 'core.delete_order' gibi union type'a çevirmek istersek
// sadece burayı değiştirmemiz yetecek.
export type PermissionType = string;

export const PERMISSION_FORMAT_REGEX = /^[a-z0-9_]+\.[a-z0-9_]+$/;
