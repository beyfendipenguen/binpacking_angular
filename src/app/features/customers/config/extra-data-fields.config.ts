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
}

export const EXTRA_DATA_FIELDS: ExtraDataFieldConfig[] = [
  {
    key: 'is_made_in_turkey',
    label: 'CUSTOMER.EXTRA_DATA.IS_MADE_IN_TURKEY',
    type: 'boolean',
    icon: 'flag'
  },
  {
    key: 'has_console',
    label: 'CUSTOMER.EXTRA_DATA.HAS_CONSOLE',
    type: 'boolean',
    icon: 'computer'
  },
  {
    key: 'label_name',
    label: 'CUSTOMER.EXTRA_DATA.LABEL_NAME',
    type: 'string',
    icon: 'label',
    validators: [Validators.required]
  },
  {
    key: 'core_type',
    label: 'CUSTOMER.EXTRA_DATA.CORE_TYPE',
    type: 'string',
    icon: 'category',
  },
  {
    key: 'fumigation_type',
    label: 'CUSTOMER.EXTRA_DATA.FUMIGATION_TYPE',
    type: 'string',
    icon: 'pest_control',
  },
  {
    key: 'side_cover_type',
    label: 'CUSTOMER.EXTRA_DATA.SIDE_COVER_TYPE',
    type: 'string',
    icon: 'shield',
  },
  {
    key: 'show_logo',
    label: 'CUSTOMER.EXTRA_DATA.SHOW_LOGO',
    type: 'boolean',
    icon: 'image'
  },
  {
    key: 'max_pallet_height',
    label: 'CUSTOMER.MAX_PALLET_HEIGHT',
    type: 'number',
    icon: 'height',
    placeholder: '2400',
    suffix: 'DIMENSIONS.MM',
    validators: [Validators.required, Validators.min(1)]
  },
  {
    key: 'truck_weight_limit',
    label: 'CUSTOMER.TRUCK_WEIGHT_LIMIT',
    type: 'number',
    icon: 'local_shipping',
    placeholder: '25000',
    suffix: 'DIMENSIONS.KG',
    validators: [Validators.required, Validators.min(1)]
  },
  {
    key: 'default_pallet_group_id',
    label: 'CUSTOMER.DEFAULT_PALLET_GROUP',
    type: 'select',
    icon: 'inventory_2',
    hint: 'CUSTOMER.PALLET_HINT',
    isSpecial: true,
    validators: [Validators.required]
  }
];
