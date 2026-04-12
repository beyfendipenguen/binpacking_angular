export interface ButtonConfig {
  icon?: string;
  text?: string;
  color?: 'primary' | 'accent' | 'warn';
  tooltip?: string;
  class?: string;
}

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'checkbox' | 'select' | 'textarea' | 'email' | 'phone' | 'button' | 'icon-button' | 'status';

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
}
