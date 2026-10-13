import { Component, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@app/core/services/toast.service';

import { ConstraintProfile } from '@app/features/interfaces/constraint-profile.interface';
import { ConstraintFormComponent } from '@app/features/customers/components/constraint-form/constraint-form.component';

export interface ConstraintDialogData {
  constraintProfile?: ConstraintProfile;
}

/**
 * Sipariş ekranından tek ilişkinin algoritma kısıtlarını düzenleme.
 * Alanlar ortak <app-constraint-form> bileşeninde; dialog sadece kabuk.
 * Kapanışta yalnızca DEĞİŞEN alanlar döner (null = iptal / değişiklik yok).
 */
@Component({
  selector: 'app-constraint-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    ConstraintFormComponent,
  ],
  templateUrl: './constraint-dialog.component.html',
  styleUrl: './constraint-dialog.component.scss',
})
export class ConstraintDialogComponent {
  @ViewChild(ConstraintFormComponent) constraintForm!: ConstraintFormComponent;

  isSaving = false;

  constructor(
    public dialogRef: MatDialogRef<ConstraintDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConstraintDialogData,
    private toastService: ToastService,
    private translate: TranslateService,
  ) { }

  onSave(): void {
    if (!this.constraintForm.valid) {
      this.constraintForm.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    const changes = this.constraintForm.getChanges();
    // Değişiklik yoksa gereksiz istek atma.
    this.dialogRef.close(Object.keys(changes).length ? (changes as ConstraintProfile) : null);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
