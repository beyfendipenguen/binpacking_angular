import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Component, Inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';


export interface FilterDialogData {
  column: string;
  displayName: string;
  currentValue: string;
  options?: any[]; // İlişkili sütunlar için dropdown seçenekleri
  isNested?: boolean; // İç içe sütun mu?
  relatedOptions?: any[]; // İlişkili alan seçenekleri
}

@Component({
  selector: 'app-filter-dialog',
  imports: [CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    TranslateModule
  ],
  templateUrl: './filter-dialog.component.html',
  styleUrl: './filter-dialog.component.scss'
})
export class FilterDialogComponent {
  filterValue: string = '';

  constructor(
    public dialogRef: MatDialogRef<FilterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FilterDialogData
  ) {
    // Mevcut filtre değerini al
    this.filterValue = data.currentValue || '';
  }

  onApply(): void {
    this.dialogRef.close(this.filterValue);
  }

  onClear(): void {
    this.dialogRef.close('');
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
