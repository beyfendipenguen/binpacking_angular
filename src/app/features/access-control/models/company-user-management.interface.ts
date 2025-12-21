export interface ICompanyUser {
    id: string;          // User modelin UUID olduğu için string
    username: string;    // Read-only (Serializer'da öyle ayarlandı)
    email: string;       // Read-only
    first_name: string;
    last_name: string;
    is_active: boolean;  // Admin pasife çekebilir

    // PrimaryKeyRelatedField olduğu için Backend ID listesi döner
    groups: number[];
    user_permissions: number[];
}

// 2. Güncelleme yaparken göndereceğimiz veri paketi (PATCH/PUT)
// ID, Username ve Email read-only olduğu için payload'a eklemeye gerek yok.
// Partial<...> da kullanabilirdik ama bu şekilde daha explicit (açık) oluyor.
export interface ICompanyUserUpdatePayload {
    first_name?: string;
    last_name?: string;
    is_active?: boolean;
    groups?: number[];           // Seçilen Grup ID'leri
    user_permissions?: number[]; // Seçilen Yetki ID'leri
}

// 3. Tabloda göstermek için UI helper (Opsiyonel)
// Ekranda "5 Yetki", "Depo Sorumlusu" gibi string göstermek için
// bu arayüzü component içinde map ederek kullanabilirsin.
export interface ICompanyUserUI extends ICompanyUser {
    groupNames?: string[]; // ID'leri isme çevirip buraya atarsın
}