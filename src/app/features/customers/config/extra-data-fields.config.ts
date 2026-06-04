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