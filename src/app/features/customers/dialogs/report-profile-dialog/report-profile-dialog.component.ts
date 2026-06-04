import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@app/core/services/toast.service';
import {
  CompanyReportProfileService,
} from '@app/features/services/company-report-profile.service';
import { CompanyReportProfile, ExtraHeaderField } from '@app/features/interfaces/report-profile.interface';

@Component({
  selector: 'app-report-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './report-profile-dialog.component.html',
  styleUrl: './report-profile-dialog.component.scss',
})
export class ReportProfileDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private profileService = inject(CompanyReportProfileService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  isLoading = signal(false);
  isSaving = signal(false);
  profile: CompanyReportProfile | null = null;
  fields: ExtraHeaderField[] = [];

  // Yeni alan formu
  newFieldForm!: FormGroup;
  isAddingField = signal(false);


  constructor(public dialogRef: MatDialogRef<ReportProfileDialogComponent>) {}

  ngOnInit(): void {
    this.newFieldForm = this.fb.group({
      key: ['', [Validators.required, Validators.pattern(/^[a-z_]+$/)]],
      label: ['', Validators.required],
    });
    this.loadProfile();
  }

  private loadProfile(): void {
    this.isLoading.set(true);
    this.profileService.getMyProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.fields = [...(profile.report_config?.extra_header_fields || [])];
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.error(this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        this.isLoading.set(false);
      },
    });
  }

  startAddField(): void {
    this.newFieldForm.reset();
    this.isAddingField.set(true);
  }

  cancelAddField(): void {
    this.isAddingField.set(false);
    this.newFieldForm.reset();
  }

  addField(): void {
    if (this.newFieldForm.invalid) {
      this.newFieldForm.markAllAsTouched();
      return;
    }

    const { key, label } = this.newFieldForm.value;

    // Duplicate key kontrolü
    if (this.fields.find((f) => f.key === key)) {
      this.toastService.error(this.translate.instant('REPORT_PROFILE.DUPLICATE_KEY'));
      return;
    }

    this.fields = [...this.fields, { key, label }];
    this.isAddingField.set(false);
    this.newFieldForm.reset();
  }

  removeField(index: number): void {
    this.fields = this.fields.filter((_, i) => i !== index);
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const arr = [...this.fields];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    this.fields = arr;
  }

  moveDown(index: number): void {
    if (index === this.fields.length - 1) return;
    const arr = [...this.fields];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    this.fields = arr;
  }

  onSave(): void {
    this.isSaving.set(true);

    const payload: Partial<CompanyReportProfile> = {
      report_config: {
        extra_header_fields: this.fields,
      },
    };

    this.profileService.updateMyProfile(payload).subscribe({
      next: () => {
        this.toastService.success(this.translate.instant('COMMON.SUCCESS'));
        this.dialogRef.close(true);
      },
      error: () => {
        this.toastService.error(this.translate.instant('COMMON.SAVE_ERROR'));
        this.isSaving.set(false);
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
