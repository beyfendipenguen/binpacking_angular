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
import { MatRadioModule } from '@angular/material/radio';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle'; // ← EKLE
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { PalletGroupService } from '../../../services/pallet-group.service';
import { ToastService } from '@app/core/services/toast.service';
import { CompanyRelation } from '../../../interfaces/company-relation.interface';
import { PalletGroup } from '../../../interfaces/pallet-group.interface';
import { AuthService } from '@app/core/auth/services/auth.service';
import { PalletGroupDialogComponent } from '@app/features/pallets/pallet-group-dialog/pallet-group-dialog.component';
import { DisableAuthDirective } from "@app/core/auth/directives/disable-auth.directive";
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

interface ExtraDataFieldConfig {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  icon: string;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  validators?: any[];
  options?: { value: any; label: string }[];
  isSpecial?: boolean;
}

interface DynamicField {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean';
}

@Component({
  selector: 'app-extra-data-dialog',
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
    MatRadioModule,
    MatExpansionModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSlideToggleModule, // ← EKLE
    TranslateModule,
    DisableAuthDirective
  ],
  templateUrl: './extra-data-dialog.component.html',
  styleUrl: './extra-data-dialog.component.scss'
})
export class ExtraDataDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private companyRelationService = inject(CompanyRelationService);
  private palletGroupService = inject(PalletGroupService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private dialogRef = inject(MatDialogRef<ExtraDataDialogComponent>);
  private dialog = inject(MatDialog);

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

  // Observables
  private destroy$ = new Subject<void>();

  // Data
  allRelations: CompanyRelation[] = [];
  selectedRelationIds: string[] = [];
  selectAllMode: 'page' | 'all' = 'page';

  // Pallet Groups
  palletGroups: PalletGroup[] = [];
  isLoadingPalletGroups = false;

  // Forms
  updateForm!: FormGroup;
  dynamicFieldForm!: FormGroup;

  // Dynamic fields
  dynamicFields: DynamicField[] = [];
  detectedExtraDataFields: { key: string; type: string; sample: any }[] = [];

  // ExtraData field configuration
  extraDataFields: ExtraDataFieldConfig[] = [
    {
      key: 'showLogo',
      label: 'CUSTOMER.EXTRA_DATA.SHOW_LOGO',
      type: 'boolean',
      icon: 'image',
    },
    {
      key: 'max_pallet_height',
      label: 'CUSTOMER.MAX_PALLET_HEIGHT',
      type: 'number',
      icon: 'height',
      placeholder: '2400',
      suffix: 'DIMENSIONS.MM',
      validators: [Validators.required, Validators.min(1)]
    },
    {
      key: 'truck_weight_limit',
      label: 'CUSTOMER.TRUCK_WEIGHT_LIMIT',
      type: 'number',
      icon: 'local_shipping',
      placeholder: '25000',
      suffix: 'DIMENSIONS.KG',
      validators: [Validators.required, Validators.min(1)]
    },
    {
      key: 'default_pallet_group_id',
      label: 'CUSTOMER.DEFAULT_PALLET_GROUP',
      type: 'select',
      icon: 'inventory_2',
      hint: 'CUSTOMER.PALLET_HINT',
      isSpecial: true,
      validators: [Validators.required]
    }
  ];

  ngOnInit(): void {
    this.initForms();
    this.setupSearchDebounce();
    this.loadRelations();
    this.loadPalletGroups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup search debounce
   */
  private setupSearchDebounce(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.currentPage = 0;
        if (this.paginator) {
          this.paginator.pageIndex = 0;
        }
        this.loadRelations();
      });
  }

  /**
   * Initialize forms
   */
  private initForms(): void {
    const formConfig: any = {
      merge_mode: ['replace'] // Default to replace
    };

    this.extraDataFields.forEach(field => {
      const validators = field.validators || [];
      formConfig[field.key] = [null, validators];
    });

    this.updateForm = this.fb.group(formConfig);

    this.dynamicFieldForm = this.fb.group({
      field_key: ['', Validators.required],
      field_value: ['', Validators.required],
      field_type: ['string', Validators.required]
    });
  }

  /**
   * Load company relations with pagination and search
   */
  private loadRelations(): void {
    this.isLoading = true;

    const params: any = {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };

    const searchTerm = this.searchControl.value?.trim();
    if (searchTerm) {
      params.search = searchTerm;
    }

    this.companyRelationService.getAll(params).subscribe({
      next: (page) => {
        this.allRelations = page.results;
        this.totalItems = page.count;
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.DATA_LOAD_ERROR'));
        this.isLoading = false;
      }
    });
  }

  /**
   * Handle page change
   */
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRelations();
  }

  /**
   * Get regular fields (non-special)
   */
  get regularFields(): ExtraDataFieldConfig[] {
    return this.extraDataFields.filter(f => !f.isSpecial);
  }

  /**
   * Get special fields
   */
  get specialFields(): ExtraDataFieldConfig[] {
    return this.extraDataFields.filter(f => f.isSpecial);
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchControl.setValue('');
  }

  /**
   * Load available pallet groups
   */
  private loadPalletGroups(): void {
    this.isLoadingPalletGroups = true;
    this.palletGroupService.getAll({ limit: 1000 }).subscribe({
      next: (page) => {
        this.palletGroups = page.results;
        this.isLoadingPalletGroups = false;
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.OPERATION_ERROR'));
        this.isLoadingPalletGroups = false;
      }
    });
  }

  /**
   * Navigate to pallet groups page
   */
  navigateToPalletGroups(): void {
    const dialogRef = this.dialog.open(PalletGroupDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      height: '80vh',
      maxHeight: '90vh',
      disableClose: false,
      panelClass: 'pallet-group-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      this.loadPalletGroups();
    });
  }

  /**
   * Toggle relation selection
   */
  toggleRelation(relationId: string): void {
    const index = this.selectedRelationIds.indexOf(relationId);
    if (index > -1) {
      this.selectedRelationIds.splice(index, 1);
    } else {
      this.selectedRelationIds.push(relationId);
    }
  }

  /**
   * Check if relation is selected
   */
  isRelationSelected(relationId: string): boolean {
    return this.selectedRelationIds.includes(relationId);
  }

  /**
   * Select all relations
   */
  selectAll(): void {
    if (this.selectAllMode === 'page') {
      const currentPageIds = this.allRelations
        .filter(r => r.id)
        .map(r => r.id!);

      const allCurrentPageSelected = currentPageIds.every(id =>
        this.selectedRelationIds.includes(id)
      );

      if (allCurrentPageSelected) {
        this.selectedRelationIds = this.selectedRelationIds.filter(
          id => !currentPageIds.includes(id)
        );
      } else {
        currentPageIds.forEach(id => {
          if (!this.selectedRelationIds.includes(id)) {
            this.selectedRelationIds.push(id);
          }
        });
      }
    } else {
      this.selectAllRecords();
    }
  }

  /**
   * Select all records from database
   */
  private selectAllRecords(): void {
    this.isLoading = true;

    this.companyRelationService.getAll({ limit: 10000 }).subscribe({
      next: (page) => {
        const allIds = page.results
          .filter(r => r.id)
          .map(r => r.id!);

        this.selectedRelationIds = allIds;
        this.toastService.success(
          this.translate.instant('CUSTOMER.EXTRA_DATA.ALL_SELECTED', { count: allIds.length })
        );
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECT_ALL_ERROR'));
        this.isLoading = false;
      }
    });
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedRelationIds = [];
    this.toastService.info(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECTION_CLEARED'));
  }

  /**
   * Get selected relations count
   */
  get selectedCount(): number {
    return this.selectedRelationIds.length;
  }

  /**
   * Check if all CURRENT PAGE relations are selected
   */
  get isAllSelected(): boolean {
    if (this.allRelations.length === 0) return false;

    const currentPageIds = this.allRelations
      .filter(r => r.id)
      .map(r => r.id!);

    return currentPageIds.every(id => this.selectedRelationIds.includes(id));
  }

  /**
   * Check if some relations are selected
   */
  get isIndeterminate(): boolean {
    if (this.selectedRelationIds.length === 0) return false;

    const currentPageIds = this.allRelations
      .filter(r => r.id)
      .map(r => r.id!);

    const selectedOnPage = currentPageIds.filter(id =>
      this.selectedRelationIds.includes(id)
    ).length;

    return selectedOnPage > 0 && selectedOnPage < currentPageIds.length;
  }

  /**
   * Go to next step
   */
  nextStep(): void {
    if (this.selectedRelationIds.length === 0) {
      this.toastService.warning(this.translate.instant('EXTRA_DATA.SELECT_AT_LEAST_ONE'));
      return;
    }
    this.currentStep = 2;
  }

  /**
   * Go to previous step
   */
  previousStep(): void {
    this.currentStep = 1;
  }

  /**
   * Add dynamic field
   */
  addDynamicField(): void {
    if (this.dynamicFieldForm.invalid) {
      this.dynamicFieldForm.markAllAsTouched();
      return;
    }

    const formValue = this.dynamicFieldForm.value;
    let value = formValue.field_value;

    if (formValue.field_type === 'number') {
      value = parseFloat(value);
      if (isNaN(value)) {
        this.toastService.error(this.translate.instant('EXTRA_DATA.INVALID_NUMBER'));
        return;
      }
    } else if (formValue.field_type === 'boolean') {
      value = value === 'true' || value === true;
    }

    const existingIndex = this.dynamicFields.findIndex(f => f.key === formValue.field_key);
    if (existingIndex > -1) {
      this.dynamicFields[existingIndex] = {
        key: formValue.field_key,
        value: value,
        type: formValue.field_type
      };
      this.toastService.info(this.translate.instant('EXTRA_DATA.FIELD_UPDATED'));
    } else {
      this.dynamicFields.push({
        key: formValue.field_key,
        value: value,
        type: formValue.field_type
      });
      this.toastService.success(this.translate.instant('EXTRA_DATA.FIELD_ADDED'));
    }

    this.dynamicFieldForm.reset({
      field_type: 'string'
    });
  }

  /**
   * Remove dynamic field
   */
  removeDynamicField(index: number): void {
    this.dynamicFields.splice(index, 1);
    this.toastService.info(this.translate.instant('EXTRA_DATA.FIELD_REMOVED'));
  }

  /**
   * Save changes
   */
  onSave(): void {
    if (this.selectedRelationIds.length === 0) {
      this.toastService.warning(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECT_AT_LEAST_ONE'));
      return;
    }

    // Form validation kontrolü - ← EKLE
    if (this.updateForm.invalid) {
      this.updateForm.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    const extraDataUpdates: any = {};

    // DEĞİŞTİR - Tüm alanları gönder (null olsa bile)
    this.extraDataFields.forEach(field => {
      const value = this.updateForm.get(field.key)?.value;
      extraDataUpdates[field.key] = value;
    });

    // Dynamic fields ekle
    this.dynamicFields.forEach(field => {
      extraDataUpdates[field.key] = field.value;
    });

    // En az bir alan dolu mu kontrol et - ← EKLE
    const hasAnyValue = Object.values(extraDataUpdates).some(val =>
      val !== null && val !== undefined && val !== ''
    );

    if (!hasAnyValue) {
      this.toastService.warning(this.translate.instant('CUSTOMER.EXTRA_DATA.NO_CHANGES'));
      return;
    }

    this.isSaving = true;

    const mergeMode = this.updateForm.get('merge_mode')?.value || 'replace';

    this.companyRelationService.bulkUpdateExtraData(
      this.selectedRelationIds,
      extraDataUpdates,
      mergeMode
    ).subscribe({
      next: (result) => {
        this.toastService.success(
          this.translate.instant('CUSTOMER.EXTRA_DATA.UPDATE_SUCCESS', { count: result.updated_count })
        );
        this.dialogRef.close(true);
      },
      error: (error) => {
        const errorMsg = error.error?.error || error.error?.message ||
          this.translate.instant('CUSTOMER.EXTRA_DATA.UPDATE_ERROR');
        this.toastService.error(errorMsg);
        this.isSaving = false;
      }
    });
  }

  /**
   * Close dialog
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }

  /**
   * Get display value for dynamic field
   */
  getDynamicFieldDisplayValue(field: DynamicField): string {
    if (field.type === 'boolean') {
      return field.value ? this.translate.instant('COMMON.YES') : this.translate.instant('COMMON.NO');
    }
    return field.value?.toString() || '';
  }
}
