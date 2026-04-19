import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WeightCategory } from '@app/features/interfaces/weight-category.interface';
import { Product } from '@app/features/interfaces/product.interface';
import { WeightCategoryService } from '@app/features/services/weight-category.service';

export interface ProductDialogData {
  product?: Product;  // edit mode için
}

export interface ProductDialogResult {
  type_name: string;
  product_type: { type: string; code: string };
  dimension: {
    width: number;
    height: number;
    depth: number;
    unit: string;
    dimension_type: string;
  };
  weights: { category_id: string; value: number }[];
}

@Component({
  selector: 'app-product-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    TranslateModule,
  ],
  templateUrl: './product-dialog.component.html',
  styleUrl: './product-dialog.component.scss',
})
export class ProductDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private weightCategoryService = inject(WeightCategoryService);

  form!: FormGroup;
  weightCategories = signal<WeightCategory[]>([]);
  isLoading = signal(false);
  isEditMode = false;

  readonly UNITS = ['mm', 'cm', 'm'];

  constructor(
    public dialogRef: MatDialogRef<ProductDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProductDialogData
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.product;
    this.buildForm();
    this.loadWeightCategories();
  }

  private buildForm(): void {
    const p = this.data?.product;
    this.form = this.fb.group({
      type_name: [p?.type_name ?? '', [Validators.required, Validators.maxLength(500)]],
      product_type_type: [p?.product_type?.type ?? '', [Validators.required, Validators.maxLength(255)]],
      product_type_code: [p?.product_type?.code ?? '', [Validators.required, Validators.maxLength(255)]],
      dimension_width: [p?.dimension?.width ?? null, [Validators.required, Validators.min(0.001)]],
      dimension_height: [p?.dimension?.height ?? null, [Validators.required, Validators.min(0.001)]],
      dimension_depth: [p?.dimension?.depth ?? null, [Validators.required, Validators.min(0.001)]],
      dimension_unit: [p?.dimension?.unit ?? 'mm', Validators.required],
    });
  }

  private loadWeightCategories(): void {
    this.isLoading.set(true);
    this.weightCategoryService.getCategories().subscribe({
      next: (categories) => {
        this.weightCategories.set(categories);
        this.addWeightControls(categories);
        this.isLoading.set(false);
      },
      error: () => {
        this.weightCategories.set([]);
        this.isLoading.set(false);
      }
    });
  }

  private addWeightControls(categories: WeightCategory[]): void {
    categories.forEach(cat => {
      const existingWeight = this.data?.product?.weights?.find(
        w => w.category.id === cat.id
      );
      this.form.addControl(
        `weight_${cat.id}`,
        this.fb.control(
          existingWeight ? Number(existingWeight.value) : null,
          [Validators.min(0)]
        )
      );
    });
  }

  getWeightControl(categoryId: string) {
    return this.form.get(`weight_${categoryId}`);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    const weights = this.weightCategories()
      .filter(cat => v[`weight_${cat.id}`] !== null && v[`weight_${cat.id}`] !== '')
      .map(cat => ({
        category_id: cat.id,
        value: Number(v[`weight_${cat.id}`])
      }));

    const result: ProductDialogResult = {
      type_name: v.type_name,
      product_type: {
        type: v.product_type_type,
        code: v.product_type_code,
      },
      dimension: {
        width: v.dimension_width,
        height: v.dimension_height,
        depth: v.dimension_depth,
        unit: v.dimension_unit,
        dimension_type: v.type_name,  // dimension_type = type_name
      },
      weights,
    };

    this.dialogRef.close(result);
  }
}
