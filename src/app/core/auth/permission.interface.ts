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
    id?: number;
    codename: string;
    content_type: {
        app_label: string;
        model: string;
    }
}

