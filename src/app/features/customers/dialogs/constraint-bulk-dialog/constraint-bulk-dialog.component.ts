import { Component, OnInit, ViewChild, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { ProductService } from '@app/features/services/product.service';
import { ToastService } from '@app/core/services/toast.service';
import { CompanyRelation } from '../../../interfaces/company-relation.interface';
import { Product } from '@app/features/interfaces/product.interface';
import { ConstraintProfile, createDefaultConstraintProfile } from '@app/features/interfaces/constraint-profile.interface';
import { CONSTRAINT_FIELDS, ConstraintFieldConfig } from '../../config/constraint-fields.config';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, switchMap, catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-constraint-bulk-dialog',
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
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatMenuModule,
    TranslateModule,
  ],
  templateUrl: './constraint-bulk-dialog.component.html',
  styleUrl: './constraint-bulk-dialog.component.scss'
})
export class ConstraintBulkDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private companyRelationService = inject(CompanyRelationService);
  private productService = inject(ProductService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private dialogRef = inject(MatDialogRef<ConstraintBulkDialogComponent>);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // State
  isLoading = false;
  isSaving = false;
  currentStep = 1;

  // Pagination & Search
  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  searchControl = new FormControl('');

  private destroy$ = new Subject<void>();

  // Data
  allRelations: CompanyRelation[] = [];
  selectedRelationIds: string[] = [];
  selectAllMode: 'page' | 'all' = 'page';

  // Constraint form
  updateForm!: FormGroup;
  constraintFields = CONSTRAINT_FIELDS;
  currentInfoField: ConstraintFieldConfig | null = null;

  // Product autocomplete (side_product_ids)
  filteredProducts: Product[] = [];
  isSearchingProducts = false;
  selectedSideProducts: Product[] = [];

  ngOnInit(): void {
    this.initForm();
    this.setupSearchDebounce();
    this.setupSideProductAutocomplete();
    this.loadRelations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Constraint grupları (customer dialog ile aynı) ───
  get constraintGroups(): Array<{ key: string; fields: ConstraintFieldConfig[] }> {
    const groupMap = new Map<string, ConstraintFieldConfig[]>();
    for (const field of this.constraintFields) {
      if (!groupMap.has(field.group)) {
        groupMap.set(field.group, []);
      }
      groupMap.get(field.group)!.push(field);
    }
    return Array.from(groupMap.entries()).map(([key, fields]) => ({ key, fields }));
  }

  showFieldInfo(field: ConstraintFieldConfig): void {
    this.currentInfoField = field;
  }

  // ─── Form init ───
  private initForm(): void {
    const constraintDefaults = createDefaultConstraintProfile();
    const formConfig: any = {};

    this.constraintFields.forEach(field => {
      if (field.disabled) return;

      if (field.type === 'multi-product') {
        formConfig[field.key] = [null];
      } else if (field.type === 'boolean') {
        // (c) kararı: boolean default değeriyle başlar, kullanıcı ne yaparsa yapar
        formConfig[field.key] = [(constraintDefaults as any)[field.key]];
      } else {
        // number/string: NULL başlar — dokunmadıysa gönderme
        formConfig[field.key] = [null, field.validators || []];
      }
    });

    formConfig['side_product_search'] = [''];
    this.updateForm = this.fb.group(formConfig);
  }

  // ─── Search debounce (extra-data dialog ile birebir) ───
  private setupSearchDebounce(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 0;
        if (this.paginator) this.paginator.pageIndex = 0;
        this.loadRelations();
      });
  }

  // ─── Relation load (extra-data dialog ile birebir) ───
  private loadRelations(): void {
    this.isLoading = true;
    const params: any = {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };
    const searchTerm = this.searchControl.value?.trim();
    if (searchTerm) params.search = searchTerm;

    this.companyRelationService.getAll(params).subscribe({
      next: (page) => {
        this.allRelations = page.results;
        this.totalItems = page.count;
        this.isLoading = false;
      },
      error: (error) => {
        if (error.status !== 403) {
          this.toastService.error(this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        }
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRelations();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  // ─── Selection (extra-data dialog ile birebir) ───
  toggleRelation(relationId: string): void {
    const index = this.selectedRelationIds.indexOf(relationId);
    if (index > -1) this.selectedRelationIds.splice(index, 1);
    else this.selectedRelationIds.push(relationId);
  }

  isRelationSelected(relationId: string): boolean {
    return this.selectedRelationIds.includes(relationId);
  }

  selectAll(): void {
    if (this.selectAllMode === 'page') {
      const currentPageIds = this.allRelations.filter(r => r.id).map(r => r.id!);
      const allSelected = currentPageIds.every(id => this.selectedRelationIds.includes(id));
      if (allSelected) {
        this.selectedRelationIds = this.selectedRelationIds.filter(id => !currentPageIds.includes(id));
      } else {
        currentPageIds.forEach(id => {
          if (!this.selectedRelationIds.includes(id)) this.selectedRelationIds.push(id);
        });
      }
    } else {
      this.selectAllRecords();
    }
  }

  private selectAllRecords(): void {
    this.isLoading = true;
    this.companyRelationService.getAll({ limit: 10000 }).subscribe({
      next: (page) => {
        this.selectedRelationIds = page.results.filter(r => r.id).map(r => r.id!);
        this.toastService.success(
          this.translate.instant('CUSTOMER.EXTRA_DATA.ALL_SELECTED', { count: this.selectedRelationIds.length })
        );
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECT_ALL_ERROR'));
        this.isLoading = false;
      }
    });
  }

  clearSelection(): void {
    this.selectedRelationIds = [];
    this.toastService.info(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECTION_CLEARED'));
  }

  get selectedCount(): number {
    return this.selectedRelationIds.length;
  }

  get isAllSelected(): boolean {
    if (this.allRelations.length === 0) return false;
    const ids = this.allRelations.filter(r => r.id).map(r => r.id!);
    return ids.every(id => this.selectedRelationIds.includes(id));
  }

  get isIndeterminate(): boolean {
    if (this.selectedRelationIds.length === 0) return false;
    const ids = this.allRelations.filter(r => r.id).map(r => r.id!);
    const selectedOnPage = ids.filter(id => this.selectedRelationIds.includes(id)).length;
    return selectedOnPage > 0 && selectedOnPage < ids.length;
  }

  nextStep(): void {
    if (this.selectedRelationIds.length === 0) {
      this.toastService.warning(this.translate.instant('EXTRA_DATA.SELECT_AT_LEAST_ONE'));
      return;
    }

    if (this.selectedRelationIds.length === 1) {
      this.initForm(); // önce sıfırla
      const selectedRelation = this.allRelations.find(r => r.id === this.selectedRelationIds[0]);
      if (selectedRelation?.constraint_profile) {
        this.populateFormFromProfile(selectedRelation.constraint_profile);
      }
    } else {
      this.initForm();
    }

    this.currentStep = 2;
  }

  private populateFormFromProfile(profile: Partial<ConstraintProfile>): void {
    const formValues: Record<string, any> = {};

    this.constraintFields.forEach(field => {
      if (field.disabled) return;
      if (field.type === 'multi-product') return; // side_product_ids ayrı ele alınıyor
      const value = (profile as any)[field.key];
      if (value !== undefined) {
        formValues[field.key] = value;
      }
    });

    this.updateForm.patchValue(formValues);

    // side_product_ids + selectedSideProducts senkronu
    if (profile.side_product_ids?.length) {
      this.updateForm.patchValue({ side_product_ids: profile.side_product_ids });
      this.loadSelectedSideProductsForBulk(profile.side_product_ids);
    }
  }

  private loadSelectedSideProductsForBulk(productIds: string[]): void {
    this.productService.getByIds(productIds).subscribe({
      next: products => (this.selectedSideProducts = products),
      error: () => {
        this.selectedSideProducts = productIds.map(id => ({ id, name: id }) as Product);
      },
    });
  }

  private resetFormToEmpty(): void {
    this.initForm(); // mevcut initForm zaten her şeyi null/default'a döndürüyor
    this.selectedSideProducts = [];
  }

  previousStep(): void {
    this.currentStep = 1;
  }

  // ─── Product autocomplete (customer dialog ile birebir) ───
  private setupSideProductAutocomplete(): void {
    this.updateForm.get('side_product_search')!.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value === 'string' && value.trim().length > 2) {
            this.isSearchingProducts = true;
            return this.productService.searchProducts(value, 10).pipe(
              catchError(() => of([])),
              finalize(() => { this.isSearchingProducts = false; })
            );
          }
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (products: Product[]) => {
          const selectedIds = new Set(this.selectedSideProducts.map(p => p.id));
          this.filteredProducts = products.filter(p => !selectedIds.has(p.id));
        },
      });
  }

  displayProductFn(product: Product): string {
    return product?.name || '';
  }

  onSideProductSelected(product: Product): void {
    if (this.selectedSideProducts.find(p => p.id === product.id)) return;
    this.selectedSideProducts.push(product);
    this.updateForm.patchValue({
      side_product_ids: this.selectedSideProducts.map(p => p.id),
      side_product_search: '',
    });
  }

  removeSideProduct(product: Product): void {
    this.selectedSideProducts = this.selectedSideProducts.filter(p => p.id !== product.id);
    this.updateForm.patchValue({
      side_product_ids: this.selectedSideProducts.map(p => p.id),
    });
  }

  // ─── Save ───
  onSave(): void {
    if (this.selectedRelationIds.length === 0) {
      this.toastService.warning(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECT_AT_LEAST_ONE'));
      return;
    }

    if (this.updateForm.invalid) {
      this.updateForm.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    // BULK MANTIK: sadece NULL OLMAYAN alanları gönder
    // (kullanıcı neyi değiştirmek istemişse onu doldurmuş)
    const constraintUpdates: any = {};
    this.constraintFields.forEach(field => {
      if (field.disabled) return;
      const value = this.updateForm.get(field.key)?.value;
      // null/undefined/boş array gönderme — "değiştirme" demek
      if (value !== null && value !== undefined) {
        // multi-product için boş array da "değiştirme" sayılabilir, ama
        // kullanıcı bilinçli boşaltmış olabilir; şimdilik dolu ise gönder
        if (field.type === 'multi-product') {
          if (Array.isArray(value) && value.length > 0) {
            constraintUpdates[field.key] = value;
          }
        } else {
          constraintUpdates[field.key] = value;
        }
      }
    });

    const hasAnyValue = Object.keys(constraintUpdates).length > 0;
    if (!hasAnyValue) {
      this.toastService.warning(this.translate.instant('CONSTRAINT.BULK.NO_CHANGES'));
      return;
    }

    this.isSaving = true;
    this.companyRelationService.bulkUpdateConstraintProfile(
      this.selectedRelationIds,
      constraintUpdates
    ).subscribe({
      next: (result) => {
        this.toastService.success(
          this.translate.instant('CONSTRAINT.BULK.UPDATE_SUCCESS', { count: result.updated_count })
        );
        this.dialogRef.close(true);
      },
      error: (error) => {
        const errorMsg = error.error?.error || error.error?.message ||
          this.translate.instant('CONSTRAINT.BULK.UPDATE_ERROR');
        this.toastService.error(errorMsg);
        this.isSaving = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
