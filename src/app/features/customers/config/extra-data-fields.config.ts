import { Validators } from '@angular/forms';

export interface ExtraDataFieldConfig {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  icon: string;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  validators?: any[];
  isSpecial?: boolean;
  // Birden fazla company relation seçiliyken (toplu düzenleme) bu alan
  // formda hiç gösterilmez. order_prefix gibi her firma için BENZERSİZ
  // olması gereken, tek tek ayarlanması gereken alanlar için kullanılır —
  // backend de zaten birden fazla relation için bu tür alanları reddeder
  // (bkz. CompanyRelationViewSet._prepare_order_prefix_update).
  hideInBulk?: boolean;
}

export const EXTRA_DATA_FIELDS: ExtraDataFieldConfig[] = [
  {
    key: 'show_logo',
    label: 'CUSTOMER.EXTRA_DATA.SHOW_LOGO',
    type: 'boolean',
    icon: 'image'
  },
  {
    // Sipariş adı öneki (PREFIX.NUMBER.RevN). Boş bırakılırsa ilk
    // siparişte otomatik atanır (çakışanlar isimden uzatılır:
    // TERM → TERMO → TERMOS). Backend boş değeri "atanmamış" sayar.
    key: 'order_prefix',
    label: 'CUSTOMER.EXTRA_DATA.ORDER_PREFIX',
    type: 'string',
    icon: 'tag',
    placeholder: 'ABC',
    hint: 'CUSTOMER.EXTRA_DATA.ORDER_PREFIX_HINT',
    validators: [Validators.maxLength(20), Validators.pattern(/^[A-Za-zÇĞİÖŞÜçğıöşü0-9]*$/)],
    hideInBulk: true,
  },
  {
    key: 'max_pallet_height',
    label: 'CUSTOMER.MAX_PALLET_HEIGHT',
    type: 'number',
    icon: 'height',
    placeholder: '2400',
    suffix: 'DIMENSIONS.MM',
    validators: [Validators.min(1)]
  },
  {
    key: 'truck_weight_limit',
    label: 'CUSTOMER.TRUCK_WEIGHT_LIMIT',
    type: 'number',
    icon: 'local_shipping',
    placeholder: '25000',
    suffix: 'DIMENSIONS.KG',
    validators: [Validators.min(1)]
  },
  {
    key: 'default_pallet_group_id',
    label: 'CUSTOMER.DEFAULT_PALLET_GROUP',
    type: 'select',
    icon: 'inventory_2',
    hint: 'CUSTOMER.PALLET_HINT',
    isSpecial: true,
    validators: []
  },
  {
    // NOT: key ismi "weight_category_id" — yeni bir isim DEĞİL, mevcut
    // /company-relations/<id>/settings/ endpoint'inin ve
    // invoice-upload.component.ts'nin (sipariş oluşturma formu) zaten
    // okuduğu key ile aynı. Burada eklenen tek şey bu değeri
    // AYARLAYABİLECEĞİMİZ bir form alanı — okuma/otomatik atama tarafı
    // zaten çalışıyordu.
    key: 'weight_category_id',
    label: 'CUSTOMER.EXTRA_DATA.DEFAULT_WEIGHT_CATEGORY',
    type: 'select',
    icon: 'scale',
    hint: 'CUSTOMER.EXTRA_DATA.DEFAULT_WEIGHT_CATEGORY_HINT',
    isSpecial: true,
    // Opsiyonel: default_pallet_group_id'nin aksine required değil —
    // boş bırakılırsa sipariş formunda otomatik weight category seçilmez.
  },
  {
    // Truck için weight_category_id ile birebir aynı pattern (yeni
    // eklenen bir çift): sipariş oluşturma formunda firma seçilince bu
    // tır otomatik atanır (bkz. invoice-upload.component.ts).
    key: 'truck_id',
    label: 'CUSTOMER.EXTRA_DATA.DEFAULT_TRUCK',
    type: 'select',
    icon: 'local_shipping',
    hint: 'CUSTOMER.EXTRA_DATA.DEFAULT_TRUCK_HINT',
    isSpecial: true,
  }
];