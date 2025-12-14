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
      'product.name': 'INVOICE_UPLOAD.TABLE.PRODUCT_NAME',
      'product.product_type.type': 'INVOICE_UPLOAD.TABLE.PRODUCT_TYPE',
      'product.product_type.code': 'INVOICE_UPLOAD.TABLE.PRODUCT_CODE',
      'product.dimension.width': 'INVOICE_UPLOAD.TABLE.WIDTH',
      'product.dimension.depth': 'INVOICE_UPLOAD.TABLE.DEPTH',
      'count': 'INVOICE_UPLOAD.TABLE.COUNT',
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
      FILE_PROCESSED: 'INVOICE_UPLOAD.SUCCESS.FILE_PROCESSED',
      ORDER_DETAIL_ADDED: 'INVOICE_UPLOAD.SUCCESS.ORDER_DETAIL_ADDED',
      CHANGES_SAVED: 'INVOICE_UPLOAD.SUCCESS.CHANGES_SAVED',
      DATA_RESTORED: 'INVOICE_UPLOAD.SUCCESS.DATA_RESTORED',
      FORCE_SAVED: 'INVOICE_UPLOAD.SUCCESS.FORCE_SAVED',
    },
    WARNING: {
      FILL_REQUIRED_FIELDS: 'INVOICE_UPLOAD.WARNING.FILL_REQUIRED_FIELDS',
      MISSING_ORDER_DETAILS: 'INVOICE_UPLOAD.WARNING.MISSING_ORDER_DETAILS',
    },
    ERROR: {
      INVALID_FILE_TYPE: 'INVOICE_UPLOAD.ERROR.INVALID_FILE_TYPE',
      FILE_TOO_LARGE: 'INVOICE_UPLOAD.ERROR.FILE_TOO_LARGE',
      FILE_PROCESSING: 'INVOICE_UPLOAD.ERROR.FILE_PROCESSING',
      COMPANY_LOADING: 'INVOICE_UPLOAD.ERROR.COMPANY_LOADING',
      TRUCK_LOADING: 'INVOICE_UPLOAD.ERROR.TRUCK_LOADING',
      OPERATION_ERROR: 'INVOICE_UPLOAD.ERROR.OPERATION_ERROR',
    },
    INFO: {
      FILE_UPLOADING: 'INVOICE_UPLOAD.INFO.FILE_UPLOADING',
      FILE_PROCESSING: 'INVOICE_UPLOAD.INFO.FILE_PROCESSING',
      OPERATION_IN_PROGRESS: 'INVOICE_UPLOAD.INFO.OPERATION_IN_PROGRESS',
    },
  },
} as const;
