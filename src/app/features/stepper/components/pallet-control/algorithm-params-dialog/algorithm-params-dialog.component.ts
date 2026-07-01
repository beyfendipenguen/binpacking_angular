import { Component, Inject, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@app/core/services/toast.service';

import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil, finalize } from 'rxjs/operators';

import { Product } from '@app/features/interfaces/product.interface';
import { ProductService } from '@app/features/services/product.service';
import { ConstraintProfile, createDefaultConstraintProfile } from '@app/features/interfaces/constraint-profile.interface';
import { CONSTRAINT_FIELDS, ConstraintFieldConfig } from '@app/features/customers/config/constraint-fields.config';

export interface AlgorithmParamsDialogData {
  constraintProfile?: ConstraintProfile;
}

@Component({
  selector: 'app-algorithm-params-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    TranslateModule,
    FormsModule
  ],
  templateUrl: './algorithm-params-dialog.component.html',
  styleUrl: './algorithm-params-dialog.component.scss',
})
export class AlgorithmParamsDialogComponent implements OnInit, OnDestroy {

  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  form!: FormGroup;
  isSaving = false;

  readonly constraintFields = CONSTRAINT_FIELDS;

  // Product autocomplete
  filteredProducts: Product[] = [];
  isSearchingProducts = false;
  selectedSideProducts: Product[] = [];
  singleZoneLimit = { x_limit_mm: 0, max_kg: 0 };
  // Info popover
  currentInfoField: ConstraintFieldConfig | null = null;

  private destroy$ = new Subject<void>();

  get constraintGroups(): Array<{ key: string; fields: ConstraintFieldConfig[] }> {
    const groupMap = new Map<string, ConstraintFieldConfig[]>();
    for (const field of this.constraintFields) {
      if (!groupMap.has(field.group)) groupMap.set(field.group, []);
      groupMap.get(field.group)!.push(field);
    }
    return Array.from(groupMap.entries()).map(([key, fields]) => ({ key, fields }));
  }

  constructor(
    public dialogRef: MatDialogRef<AlgorithmParamsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlgorithmParamsDialogData,
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.setupSideProductAutocomplete();

    if (this.data?.constraintProfile) {
      this.populateForm(this.data.constraintProfile);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  showFieldInfo(field: ConstraintFieldConfig): void {
    this.currentInfoField = field;
  }

  displayProductFn(product: Product): string {
    return product?.name || '';
  }

  onSideProductSelected(product: Product): void {
    if (this.selectedSideProducts.find(p => p.id === product.id)) return;
    this.selectedSideProducts.push(product);
    this.form.patchValue({
      side_product_ids: this.selectedSideProducts.map(p => p.id),
      side_product_search: '',
    });
    this.filteredProducts = [];
  }

  removeSideProduct(product: Product): void {
    this.selectedSideProducts = this.selectedSideProducts.filter(p => p.id !== product.id);
    this.form.patchValue({ side_product_ids: this.selectedSideProducts.map(p => p.id) });
  }



  onZoneLimitChange(): void {
    // Sadece dolu ise gönder (ikisi de 0 ise boş array)
    const hasValue = this.singleZoneLimit.x_limit_mm > 0 || this.singleZoneLimit.max_kg > 0;
    this.form.patchValue({
      zone_weight_limits: hasValue ? [{ ...this.singleZoneLimit }] : []
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    const formValue = this.form.value;
    const payload: Partial<ConstraintProfile> = {};

    this.constraintFields.forEach(field => {
      if (field.disabled) return;
      const value = formValue[field.key];
      if (value != null) (payload as any)[field.key] = value;
    });

    this.dialogRef.close(payload as ConstraintProfile);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private initForm(): void {
    const defaults = createDefaultConstraintProfile();
    const formConfig: Record<string, any> = {};

    this.constraintFields.forEach(field => {
      if (field.disabled) return;
      if (field.type === 'multi-product' || field.type === 'zone-limits') {
        formConfig[field.key] = [(defaults as any)[field.key] ?? []];
      } else {
        formConfig[field.key] = [(defaults as any)[field.key], field.validators ?? []];
      }
    });

    formConfig['side_product_search'] = [''];
    this.form = this.fb.group(formConfig);
  }

  private setupSideProductAutocomplete(): void {
    this.form.get('side_product_search')!.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(value => {
          if (typeof value !== 'string' || value.trim().length < 3) return of([]);
          this.isSearchingProducts = true;
          return this.productService.searchProducts(value.trim(), 10).pipe(
            catchError(() => of([])),
            finalize(() => (this.isSearchingProducts = false)),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((products: Product[]) => {
        const selectedIds = new Set(this.selectedSideProducts.map(p => p.id));
        this.filteredProducts = products.filter(p => !selectedIds.has(p.id));
      });
  }

  private populateForm(profile: ConstraintProfile): void {
    const defaults = createDefaultConstraintProfile();
    const formValues: Record<string, any> = {};

    this.constraintFields.forEach(field => {
      if (field.disabled) return;
      formValues[field.key] = (profile as any)[field.key] ?? (defaults as any)[field.key];
    });

    this.form.patchValue(formValues);
    const zones = profile.zone_weight_limits ?? [];
    this.singleZoneLimit = zones.length > 0
      ? { ...zones[0] }
      : { x_limit_mm: 0, max_kg: 0 };
    this.loadSelectedSideProducts(profile.side_product_ids ?? []);
  }

  private loadSelectedSideProducts(productIds: string[]): void {
    if (!productIds.length) {
      this.selectedSideProducts = [];
      return;
    }
    this.productService.getByIds(productIds).subscribe({
      next: products => (this.selectedSideProducts = products),
      error: () => {
        this.selectedSideProducts = productIds.map(id => ({ id, name: id } as Product));
      },
    });
  }
}
