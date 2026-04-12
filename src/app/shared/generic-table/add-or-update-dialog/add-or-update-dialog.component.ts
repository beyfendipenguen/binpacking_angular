import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
  ValidatorFn
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ColumnDefinition } from '../interfaces/column-definition.interface';

interface DialogData {
  row: any;
  columns: ColumnDefinition[];
  options?: any;
  visibleFields?: string[];
}

const EXCLUDED_FIELDS = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'actions'];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

@Component({
  selector: 'app-add-or-update-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './add-or-update-dialog.component.html',
  styleUrl: './add-or-update-dialog.component.scss'
})
export class AddOrUpdateDialogComponent implements OnInit {
  form: FormGroup = new FormGroup({});
  fields: ColumnDefinition[] = [];
  isEditMode = false;
  dialogTitle = '';

  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  constructor(
    public dialogRef: MatDialogRef<AddOrUpdateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.row;
    this.dialogTitle = this.isEditMode
      ? this.translate.instant('GENERIC_TABLE.UPDATE_RECORD')
      : this.translate.instant('GENERIC_TABLE.ADD_NEW_RECORD');
    this.initializeFields();
    this.buildForm();
  }

  private initializeFields(): void {
    const columns = this.data?.columns || [];
    const visibleFields = this.data?.visibleFields;

    this.fields = columns
      .filter(col => {
        if (EXCLUDED_FIELDS.includes(col.key)) return false;
        if (visibleFields && !visibleFields.includes(col.key)) return false;
        return true;
      })
      .map(col => this.prepareField(col));
  }

  private prepareField(col: ColumnDefinition): ColumnDefinition {
    return {
      ...col,
      path: col.key.includes('.') ? col.key.split('.') : [col.key],
      label: col.label || this.formatLabel(col.key),
      type: col.type || 'text'
    };
  }

  private buildForm(): void {
    const config: any = {};
    this.fields.forEach(field => {
      const safeKey = this.sanitizeKey(field.key);
      let initialValue: any = '';
      if (this.isEditMode && field.path) {
        initialValue = this.getValueByPath(this.data.row, field.path);
      }
      if (initialValue === undefined || initialValue === null) {
        if (field.type === 'number') initialValue = null;
        else if (field.type === 'checkbox') initialValue = false;
        else if (field.type === 'date' || field.type === 'datetime') initialValue = null;
        else initialValue = '';
      }
      config[safeKey] = [initialValue, this.buildValidators(field)];
    });
    this.form = this.fb.group(config);
  }

  private buildValidators(field: ColumnDefinition): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (field.required) {
      validators.push(Validators.required);
    }

    switch (field.type) {
      case 'number':
        validators.push(Validators.min(field.min ?? 0));
        if (field.max !== undefined) validators.push(Validators.max(field.max));
        break;

      case 'email':
        validators.push(Validators.email);
        validators.push(Validators.pattern(EMAIL_REGEX));
        break;

      case 'phone':
        validators.push(Validators.pattern(field.pattern || PHONE_REGEX));
        break;

      case 'text':
        if (field.minLength) validators.push(Validators.minLength(field.minLength));
        validators.push(Validators.maxLength(field.maxLength ?? 255));
        break;

      case 'textarea':
        if (field.minLength) validators.push(Validators.minLength(field.minLength));
        validators.push(Validators.maxLength(field.maxLength ?? 1000));
        break;
    }

    if (field.pattern && field.type !== 'phone') {
      validators.push(Validators.pattern(field.pattern));
    }

    return validators;
  }

  getErrorMessage(field: ColumnDefinition): string {
    const control = this.form.get(this.sanitizeKey(field.key));
    if (!control?.errors) return '';
    const errors = control.errors;
    if (errors['required']) return this.translate.instant('VALIDATION.REQUIRED');
    if (errors['email']) return this.translate.instant('VALIDATION.EMAIL');
    if (errors['min']) return this.translate.instant('VALIDATION.MIN', { min: errors['min'].min });
    if (errors['max']) return this.translate.instant('VALIDATION.MAX', { max: errors['max'].max });
    if (errors['minlength']) return this.translate.instant('VALIDATION.MIN_LENGTH', { length: errors['minlength'].requiredLength });
    if (errors['maxlength']) return this.translate.instant('VALIDATION.MAX_LENGTH', { length: errors['maxlength'].requiredLength });
    if (errors['pattern']) return this.translate.instant('VALIDATION.PATTERN');
    return this.translate.instant('VALIDATION.INVALID');
  }
  sanitizeKey(key: string): string {
  return key.replace(/\./g, '_');
}


  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const formValues = this.form.getRawValue();
    let result: any = this.isEditMode ? { ...this.data.row } : {};
    for (const field of this.fields) {
      if (field.path) {
        this.setValueByPath(result, field.path, formValues[this.sanitizeKey(field.key)]);
      }
    }
    this.dialogRef.close(result);
  }

  private getValueByPath(obj: any, path: string[]): any {
    return path.reduce((cur, key) => cur?.[key], obj);
  }

  private setValueByPath(obj: any, path: string[], value: any): void {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!cur[path[i]]) cur[path[i]] = {};
      cur = cur[path[i]];
    }
    cur[path[path.length - 1]] = value;
  }

  private formatLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ');
  }
}
