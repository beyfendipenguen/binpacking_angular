import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { FieldOption, FieldType } from '../interfaces/column-definition.interface';

export interface FilterDialogData {
  column: string;
  displayName: string;
  currentValue: string;
  type?: FieldType;
  options?: FieldOption[];
}

@Component({
  selector: 'app-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './filter-dialog.component.html',
  styleUrl: './filter-dialog.component.scss'
})
export class FilterDialogComponent {
  filterControl: FormControl;

  constructor(
    public dialogRef: MatDialogRef<FilterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FilterDialogData
  ) {
    const validators = data.type === 'number' ? [Validators.min(0)] : [];
    this.filterControl = new FormControl(data.currentValue || '', validators);
  }

  get fieldType(): FieldType {
    return this.data.type || 'text';
  }

  onApply(): void {
    if (this.filterControl.invalid) return;
    const value = this.filterControl.value;
    this.dialogRef.close(value !== null && value !== undefined ? String(value) : '');
  }

  onClear(): void {
    this.dialogRef.close('');
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
