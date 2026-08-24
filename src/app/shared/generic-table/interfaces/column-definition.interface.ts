export interface ButtonConfig {
  icon?: string;
  text?: string;
  color?: 'primary' | 'accent' | 'warn';
  tooltip?: string;
  class?: string;
}

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'checkbox' | 'select' | 'textarea' | 'email' | 'phone' | 'button' | 'icon-button' | 'status'|'weights';

export interface FieldOption {
  value: any;
  label: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  buttonConfig?: ButtonConfig;

  // Form & validation
  options?: FieldOption[];
  path?: string[];
  visible?: boolean;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string | RegExp;

  /**
   * true ise, bu kolonun hücresinde satırın (row) extra_data alanındaki
   * key/value çiftleri tooltip olarak gösterilir (extra_data boş/tanımsızsa
   * hiç tooltip gösterilmez). Generic table'ı kullanan herhangi bir sayfa,
   * herhangi bir kolonda bunu true yapabilir — bkz. orders.component.ts
   * 'name' kolonu.
   */
  showRowExtraData?: boolean;
}
