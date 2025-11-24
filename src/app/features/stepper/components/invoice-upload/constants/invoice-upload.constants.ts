export const INVOICE_UPLOAD_CONSTANTS = {
  FILE: {
    VALID_TYPES: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
  },

  TABLE: {
    DISPLAYED_COLUMNS: [
      'product.name',
      'product.product_type.type',
      'product.product_type.code',
      'product.dimension.width',
      'product.dimension.depth',
      'count',
    ] as string[],

    COLUMN_TYPES: {
      'product.name': "text",
      'product.product_type.type': "text",
      'product.product_type.code': "text",
      'product.dimension.width': "number",
      'product.dimension.depth': "number",
      'count': "number",
    } as { [key: string]: string },

    FILTERABLE_COLUMNS: [
      'product.name',
      'product.product_type.type',
      'product.product_type.code',
      'product.dimension.width',
      'product.dimension.depth',
      'count',
    ] as string[],

    NESTED_DISPLAY_COLUMNS: {
      'product.name': 'Ürün Adı',
      'product.product_type.type': 'Ürün Tipi',
      'product.product_type.code': 'Ürün Kodu',
      'product.dimension.width': 'Genişlik',
      'product.dimension.depth': 'Derinlik',
      'count': 'Adet',
    },

    EXCLUDE_FIELDS: [
      'product.name',
      'product.product_type.type',
      'product.product_type.code',
      'product.dimension.width',
      'product.dimension.depth',
    ] as string[],
  },

  AUTO_SAVE: {
    INTERVAL_MS: 1000,
  },

  MESSAGES: {
    SUCCESS: {
      FILE_PROCESSED: 'Dosya İşlendi',
      ORDER_DETAIL_ADDED: 'Sipariş detayı başarıyla eklendi.',
      CHANGES_SAVED: 'Değişiklikler başarıyla kaydedildi',
      DATA_RESTORED: 'Önceki verileriniz restore edildi',
      FORCE_SAVED: 'Veriler zorla kaydedildi',
    },
    WARNING: {
      FILL_REQUIRED_FIELDS: 'Lütfen tüm zorunlu alanları doldurun (Sipariş No, Tarih, Müşteri, Tır, Ağırlık Tipi, Kat Adedi, Ağırlık Limiti)',
      MISSING_ORDER_DETAILS: 'Sipariş detayları eksik. Lütfen kontrol ediniz.',
    },
    ERROR: {
      INVALID_FILE_TYPE: 'Geçersiz dosya türü. Lütfen uygun formatta Excel dosyası yükleyin ya da örnek ISB raporunu indirin.',
      FILE_TOO_LARGE: 'Dosya boyutu 10 MB sınırını aşıyor.',
      FILE_PROCESSING: 'Dosya işlenirken bir hata oluştu.',
      COMPANY_LOADING: 'Profil bilgisi yüklenirken hata oluştu CompanyRelation',
      TRUCK_LOADING: 'Tır bilgisi yüklenirken hata oluştu',
      OPERATION_ERROR: 'İşlem sırasında hata oluştu: ',
    },
    INFO: {
      FILE_UPLOADING: 'Dosya yükleniyor...',
      FILE_PROCESSING: 'Dosya işleniyor...',
      OPERATION_IN_PROGRESS: 'İşlem gerçekleştiriliyor...',
    },
  },
} as const;
