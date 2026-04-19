import {
  Component, OnInit, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder, FormGroup, Validators,
  ReactiveFormsModule, FormsModule
} from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WeightCategoryService } from '@app/features/services/weight-category.service';
import { WeightCategory } from '@app/features/interfaces/weight-category.interface';
import { ToastService } from '@app/core/services/toast.service';

@Component({
  selector: 'app-weight-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './weight-category-dialog.component.html',
  styleUrl: './weight-category-dialog.component.scss',
})
export class WeightCategoryDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private weightCategoryService = inject(WeightCategoryService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  categories = signal<WeightCategory[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);
  editingId = signal<string | null>(null);

  form!: FormGroup;

  constructor(public dialogRef: MatDialogRef<WeightCategoryDialogComponent>) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadCategories();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      key: ['', [
        Validators.required,
        Validators.maxLength(50),
        Validators.pattern(/^[a-z0-9_]+$/)  // sadece lowercase, rakam, _
      ]],
      label: ['', [Validators.required, Validators.maxLength(100)]],
    });
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.weightCategoryService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  startEdit(cat: WeightCategory): void {
    this.editingId.set(cat.id);
    this.form.patchValue({ key: cat.key, label: cat.label });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.getRawValue();
    this.isSaving.set(true);

    const editId = this.editingId();

    if (editId) {
      this.weightCategoryService.update(editId, payload).subscribe({
        next: () => {
          this.toastService.success(
            this.translate.instant('WEIGHT_CATEGORY.UPDATE_SUCCESS')
          );
          this.editingId.set(null);
          this.form.reset();
          this.isSaving.set(false);
          this.loadCategories();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toastService.error(
            err.error?.detail || this.translate.instant('WEIGHT_CATEGORY.UPDATE_ERROR')
          );
        }
      });
    } else {
      this.weightCategoryService.create(payload).subscribe({
        next: () => {
          this.toastService.success(
            this.translate.instant('WEIGHT_CATEGORY.CREATE_SUCCESS')
          );
          this.form.reset();
          this.isSaving.set(false);
          this.loadCategories();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.toastService.error(
            err.error?.detail || this.translate.instant('WEIGHT_CATEGORY.CREATE_ERROR')
          );
        }
      });
    }
  }

  delete(cat: WeightCategory): void {
    if (!confirm(
      this.translate.instant('WEIGHT_CATEGORY.DELETE_CONFIRM', { label: cat.label })
    )) return;

    this.weightCategoryService.delete(cat.id).subscribe({
      next: () => {
        this.toastService.success(
          this.translate.instant('WEIGHT_CATEGORY.DELETE_SUCCESS')
        );
        this.loadCategories();
        if (this.editingId() === cat.id) this.cancelEdit();
      },
      error: () => {
        this.toastService.error(
          this.translate.instant('WEIGHT_CATEGORY.DELETE_ERROR')
        );
      }
    });
  }

  get isEditing(): boolean {
    return this.editingId() !== null;
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
