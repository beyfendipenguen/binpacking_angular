import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';

import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Alan tanımı için geliştirilmiş arayüz
interface FieldDefinition {
  key: string;        // Form kontrolü adı (dot notation destekler: 'user.address.city')
  label: string;      // Kullanıcı dostu etiket
  type: string;       // Alan tipi: text, number, date, checkbox, select, textarea
  required: boolean;  // Zorunlu alan mı?
  options?: any[];    // Select için seçenekler
  path?: string[];    // İç içe geçmiş yol bölümleri (hesaplanır)
  visible?: boolean;  // Bu alan görünür mü? (varsayılan: true)
}

// Dialog veri arayüzü
interface DialogData {
  row: any;                 // Düzenlenecek veri nesnesi
  columns: FieldDefinition[]; // Sütun tanımları
  options?: any;            // Form seçenekleri (örn. dropdown listelerinin verileri)
  visibleFields?: string[]; // Yalnızca belirli alanları göstermek için isteğe bağlı filtre
}

@Component({
  selector: 'app-add-or-update-dialog-component',
  standalone: true,
  imports: [ CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,TranslateModule],
  templateUrl: './add-or-update-dialog-component.html',
  styleUrl: './add-or-update-dialog-component.scss'
})
export class AddOrUpdateDialogComponent implements OnInit {
  form: FormGroup = new FormGroup({});
  fields: FieldDefinition[] = [];
  isEditMode: boolean = false;
  dialogTitle: string = '';
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);


  constructor(
    public dialogRef: MatDialogRef<AddOrUpdateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  ngOnInit(): void {
    // Data kontrolü - data objesi ve columns array'i kontrol edilir
    if (!this.data || !this.data.columns || this.data.columns.length === 0) {
      // En az bir varsayılan alan ekle ki form boş kalmasın
      this.data = this.data || {};
      this.data.columns = this.data.columns || [
        { key: 'defaultField', label: 'Varsayılan Alan', type: 'text', required: false }
      ];
    }

    this.isEditMode = !!this.data.row;
    this.dialogTitle = this.isEditMode ? this.translate.instant('GENERIC_TABLE.UPDATE_RECORD') : this.translate.instant('GENERIC_TABLE.ADD_NEW_RECORD');
    this.initializeFields();

    // Fields kontrolü
    if (this.fields.length === 0) {
      this.addDefaultField();
    }

    this.buildForm();
  }

  /**
   * Varsayılan alan ekler - hiç alan bulunamadığında
   */
  private addDefaultField(): void {
    this.fields.push({
      key: 'defaultField',
      label: this.translate.instant('GENERIC_TABLE.VALUE'),
      type: 'text',
      required: false,
      path: ['defaultField']
    });
  }

  /**
   * Alanları başlatır - artık iç içe alanları da destekler
   */
  private initializeFields(): void {
    if (this.isEditMode) {
      // Düzenleme modunda, veri nesnesinden alan tanımlarını oluşturur
      const row = this.data.row;

      // Eğer görünür alanlar filtrelenmişse, sadece bu alanları göster
      if (this.data.visibleFields && this.data.visibleFields.length > 0) {
        this.fields = this.data.visibleFields
          .filter(key => !this.shouldExcludeField(key))
          .map(key => this.createFieldFromPath(key, row));
      } else if (this.data.columns) {
        // Sütun tanımları varsa, onları kullan (düzenleme modunda bile)
        this.fields = this.data.columns
          .filter(col => !this.shouldExcludeField(col.key) &&
                         this.isFieldVisible(col.key))
          .map(col => this.prepareField(col));
      } else {
        // Varsayılan olarak tüm nesneyi işle
        this.fields = this.extractFieldsFromObject(row);
      }
    } else if (this.data.columns) {
      // Ekleme modunda, verilen sütun tanımlarını kullan
      this.fields = this.data.columns
        .filter(col => !this.shouldExcludeField(col.key) &&
                       this.isFieldVisible(col.key))
        .map(col => this.prepareField(col));
    }
  }

  /**
   * Bir alan yolu/anahtarı ve nesne verilerek alan tanımı oluşturur
   */
  private createFieldFromPath(path: string, obj: any): FieldDefinition {
    const pathParts = path.split('.');
    let value = this.getValueByPath(obj, pathParts);

    // Sütun tanımlarında bu alana ait bir tanım varsa, onu kullan
    const columnDef = this.data.columns?.find(col => col.key === path);

    if (columnDef) {
      return this.prepareField(columnDef);
    }

    return {
      key: path,
      label: this.formatLabel(pathParts[pathParts.length - 1]),
      type: this.getInputType(value),
      required: true,
      path: pathParts
    };
  }

  /**
   * Verilen sütun tanımını hazırlar ve yol bölümlerini ayrıştırır
   */
  private prepareField(column: FieldDefinition): FieldDefinition {
    const field = { ...column };

    // Nokta notasyonlu key'i ayrıştır
    if (field.key.includes('.')) {
      field.path = field.key.split('.');
    } else {
      field.path = [field.key];
    }

    // Etiket yoksa, oluştur
    if (!field.label) {
      field.label = this.formatLabel(field.path[field.path.length - 1]);
    }

    // Tip yoksa, 'text' olarak varsay
    if (!field.type) {
      field.type = 'text';
    }

    return field;
  }

  /**
   * Bir nesneyi tarar ve alan tanımlarını çıkarır (iç içe alanlar dahil)
   */
  private extractFieldsFromObject(obj: any, prefix: string = ''): FieldDefinition[] {
    if (!obj || typeof obj !== 'object') return [];

    let fields: FieldDefinition[] = [];

    for (const key in obj) {
      if (this.shouldExcludeField(key)) continue;

      const value = obj[key];
      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
        // İç içe nesne - iç özelliklerini çıkar
        fields = fields.concat(this.extractFieldsFromObject(value, fullPath));
      } else {
        // Basit değer - alan oluştur
        if (this.isFieldVisible(fullPath)) {
          fields.push({
            key: fullPath,
            label: this.formatLabel(key),
            type: this.getInputType(value),
            required: true,
            path: fullPath.split('.')
          });
        }
      }
    }

    return fields;
  }

  /**
   * Belirtilen yoldaki değeri nesne içinden alır
   */
  private getValueByPath(obj: any, path: string[]): any {
    let current = obj;

    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }

    return current;
  }

  /**
   * Belirtilen yola göre nesne içindeki değeri ayarlar
   */
  private setValueByPath(obj: any, path: string[], value: any): void {
    let current = obj;

    // Son öğeye kadar ilerle
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];

      // Yol yoksa oluştur
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }

      current = current[key];
    }

    // Son öğe için değeri ayarla
    const lastKey = path[path.length - 1];
    current[lastKey] = value;
  }

  /**
   * Bir alanın gösterilip gösterilmemesi gerektiğini belirler
   */
  private isFieldVisible(key: string): boolean {
    if (!this.data.visibleFields) return true;
    return this.data.visibleFields.includes(key);
  }

  /**
   * Belirli alanları form oluşturma sürecinden hariç tutmak için kullanılır
   */
  private shouldExcludeField(key: string): boolean {
  // System alanları ve actions
  const excludedFields = [
    'id',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
    'actions'
  ];

  // Key'in kendisi excluded mi?
  if (excludedFields.includes(key)) {
    return true;
  }

  // Nested key'in son kısmı excluded mi? (örn: 'user.created_at')
  const lastPart = key.split('.').pop() || '';
  return excludedFields.includes(lastPart);
}

  /**
   * Anahtar adını kullanıcı dostu bir etikete dönüştürür
   */
  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' '); // Alt çizgileri boşluklara dönüştür
  }

  /**
   * Verilen değerin tipine göre form alanı tipini belirler
   */
  private getInputType(value: any): string {
    if (value === null || value === undefined) return 'text';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    if (typeof value === 'boolean') return 'checkbox';
    if (Array.isArray(value)) return 'select';
    return 'text';
  }

  /**
   * Form nesnesini oluşturur ve alanları ekler
   */
  private buildForm(): void {
    const formConfig: any = {};

    this.fields.forEach(field => {
      let initialValue: any = '';

      if (this.isEditMode && field.path) {
        initialValue = this.getValueByPath(this.data.row, field.path);
      }

      // Alanın tipine göre uygun varsayılan değeri ayarla
      if (initialValue === undefined || initialValue === null) {
        if (field.type === 'number') initialValue = 0;
        else if (field.type === 'checkbox') initialValue = false;
        else if (field.type === 'date') initialValue = null;
        else if (field.type === 'select') initialValue = '';
        else initialValue = ''; // text ve diğerleri
      }

      formConfig[field.key] = [
        initialValue,
        field.required ? Validators.required : []
      ];
    });

    this.form = this.fb.group(formConfig);
  }

  /**
   * İptal butonuna tıklandığında dialog'u kapatır
   */
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * Form gönderildiğinde çalışır
   */
  onSubmit(): void {
    if (this.form.valid) {
      const formValues = this.form.getRawValue();
      let result: any = {};

      // Düzenleme modunda temel nesneyi kopyala
      if (this.isEditMode) {
        result = { ...this.data.row };
      }

      // Form değerlerini iç içe nesneye dönüştür
      for (const field of this.fields) {
        if (field.path && field.path.length > 0) {
          const value = formValues[field.key];
          this.setValueByPath(result, field.path, value);
        }
      }
      this.dialogRef.close(result);
    }
  }
}
