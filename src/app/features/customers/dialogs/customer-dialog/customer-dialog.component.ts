import { Component, Inject, OnInit, inject, OnDestroy } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { PalletGroupService } from '../../../services/pallet-group.service';
import { ToastService } from '@app/core/services/toast.service';
import {
  CompanyRelation,
  CompanyRelationDto,
  RELATION_TYPE_OPTIONS,
  createDefaultCompanyRelation
} from '../../../interfaces/company-relation.interface';
import { Company } from '../../../interfaces/company.interface';
import { PalletGroup } from '../../../interfaces/pallet-group.interface';
import { finalize, map, startWith } from 'rxjs/operators';
import { AddCompanyDialogComponent, CompanyDialogData } from '../add-company-dialog/add-company-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PalletGroupDialogComponent } from '@app/features/pallets/pallet-group-dialog/pallet-group-dialog.component';
import { DisableAuthDirective } from "@app/core/auth/directives/disable-auth.directive";
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { Observable, Subject, of } from 'rxjs'; // ← Subject ve of ekle
import { debounceTime, distinctUntilChanged, switchMap, catchError, takeUntil } from 'rxjs/operators'; // ← Operatörleri ekle
import { EXTRA_DATA_FIELDS } from '../../config/extra-data-fields.config';
import { MatChipsModule } from '@angular/material/chips';
import { Product } from '@app/features/interfaces/product.interface';
import { ProductService } from '@app/features/services/product.service';
import { MatMenuModule } from '@angular/material/menu';

export interface CustomerDialogData {
  mode: 'create' | 'edit';
  relation?: CompanyRelation;
}
interface ExtraDataFieldConfig {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  icon: string;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  validators?: any[];
  isSpecial?: boolean; // pallet_group_id için
}

@Component({
  selector: 'app-customer-dialog',
  standalone: true,
  imports: [CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    TranslateModule,
    MatTooltipModule,
    DisableAuthDirective,
    HasPermissionDirective,
    MatChipsModule,
    MatMenuModule],
  templateUrl: './customer-dialog.component.html',
  styleUrl: './customer-dialog.component.scss'
})
export class CustomerDialogComponent implements OnInit, OnDestroy {

  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private companyRelationService = inject(CompanyRelationService);
  private productService = inject(ProductService);
  private palletGroupService = inject(PalletGroupService);
  private toastService = inject(ToastService);
  private dialog = inject(MatDialog);

  form!: FormGroup;
  isLoading = false;
  isSaving = false;
  relationTypeOptions = RELATION_TYPE_OPTIONS;
  // Company autocomplete
  filteredCompanies$!: Observable<Company[]>;
  selectedCompany: Company | null = null;
  isSearchingCompanies = false; // ← EKLE
  // Pallet Groups
  palletGroups: PalletGroup[] = [];
  isLoadingPalletGroups = false;
  extraDataFields = EXTRA_DATA_FIELDS;

  // Product autocomplete için
  filteredProducts: Product[] = [];
  isSearchingProducts = false;
  hasProductSearchError = false;
  selectedSideProducts: Product[] = []; // UI'da chip olarak gösterilecek
  productSearchControl: any; // ngOnInit'te kurulur
  private destroy$ = new Subject<void>();

  constructor(
    public dialogRef: MatDialogRef<CustomerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CustomerDialogData
  ) { }

  get regularExtraDataFields(): ExtraDataFieldConfig[] {
    return this.extraDataFields.filter(f => !f.isSpecial);
  }

  get specialExtraDataFields(): ExtraDataFieldConfig[] {
    return this.extraDataFields.filter(f => f.isSpecial);
  }

  ngOnInit(): void {
    this.initForm();
    // this.loadCompanies(); // ← BUNU SİL - Artık lazy loading
    this.loadPalletGroups();
    this.setupCompanyAutocomplete();
    this.setupSideProductAutocomplete();

    if (this.data.mode === 'edit' && this.data.relation) {
      this.populateForm(this.data.relation);
    }
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize form
   */
  private initForm(): void {
    const defaults = createDefaultCompanyRelation();

    const formConfig: any = {
      target_company: [null, Validators.required],
      target_company_search: [''],
      relation_type: [defaults.relation_type, Validators.required],
      is_active: [defaults.is_active],
      notes: [defaults.notes],
    };

    // Extra data fields (mevcut)
    this.extraDataFields.forEach(field => {
      const defaultValue = field.key === 'default_pallet_group_id'
        ? defaults.extra_data?.default_pallet_group_id
        : (defaults.extra_data as any)?.[field.key];
      const validators = field.validators || [];
      formConfig[field.key] = [defaultValue, validators];
    });

    // Product autocomplete için search control
    formConfig['side_product_search'] = [''];

    this.form = this.fb.group(formConfig);
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
      this.loadPalletGroups()
    });
  }

  /**
   * Setup company autocomplete filter
   */
  private setupCompanyAutocomplete(): void {
    this.filteredCompanies$ = this.form.get('target_company_search')!.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        const searchTerm = typeof value === 'string' ? value : value?.company_name || '';

        if (!searchTerm || searchTerm.trim().length < 2) {
          this.isSearchingCompanies = false;
          return of([]);
        }

        this.isSearchingCompanies = true;

        return this.companyRelationService.getAll({
          search: searchTerm.trim(),
          limit: 5
        }).pipe(
          map(response => {
            this.isSearchingCompanies = false;
            // Extract unique target companies
            const companyMap = new Map<string, Company>();
            response.results.forEach(relation => {
              if (relation.target_company && relation.target_company.id) {
                companyMap.set(relation.target_company.id, relation.target_company);
              }
            });
            return Array.from(companyMap.values());
          }),
          catchError(error => {
            this.isSearchingCompanies = false;
            return of([]);
          })
        );
      }),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Display company name in autocomplete
   */
  displayCompanyFn(company: Company): string {
    return company ? `${company.company_name} (${company.country})` : '';
  }

  /**
   * Handle company selection
   */
  onCompanySelected(company: Company): void {
    this.selectedCompany = company;
    this.form.patchValue({ target_company: company.id });
  }

  /**
   * Populate form with existing relation data
   */
  private populateForm(relation: CompanyRelation): void {
    this.selectedCompany = relation.target_company;

    const formValues: any = {
      target_company: relation.target_company.id,
      target_company_search: relation.target_company,
      relation_type: relation.relation_type,
      is_active: relation.is_active,
      notes: relation.notes,
    };

    // Extra data (mevcut)
    this.extraDataFields.forEach(field => {
      formValues[field.key] = (relation.extra_data as any)?.[field.key] ?? null;
    });

    this.form.patchValue(formValues);

  }
  // ─── Side product autocomplete ───
  private setupSideProductAutocomplete(): void {
    this.form.get('side_product_search')!.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((value) => {
          // Product seçilince valueChanges Product objesi gönderir, biz string istiyoruz
          if (typeof value === 'string' && value.trim().length > 2) {
            this.isSearchingProducts = true;
            this.hasProductSearchError = false;

            return this.productService
              .searchProducts(value, 10)
              .pipe(
                catchError(() => {
                  this.hasProductSearchError = true;
                  return of([]);
                }),
                finalize(() => {
                  this.isSearchingProducts = false;
                })
              );
          }
          return of([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (products: Product[]) => {
          // Zaten seçili olanları gösterme
          const selectedIds = new Set(this.selectedSideProducts.map(p => p.id));
          this.filteredProducts = products.filter(p => !selectedIds.has(p.id));
        },
      });
  }

  /**
   * Edit modunda gelen UUID listesini Product objelerine çevir
   * (chip olarak göstermek için)
   */
  private loadSelectedSideProducts(productIds: string[]): void {
    if (!productIds || productIds.length === 0) {
      this.selectedSideProducts = [];
      return;
    }
    // ProductService'inde "id listesiyle çek" metodun var mı?
    // Yoksa tek tek getById çağırmak ya da searchProducts ile filtrelemek gerekir.
    // Şimdilik basit yaklaşım: searchProducts'la veya getByIds varsa onunla
    // (Senin ProductService'ine göre uyarla)
    this.productService.getByIds(productIds).subscribe({
      next: (products) => {
        this.selectedSideProducts = products;
      },
      error: () => {
        // Sessiz fail, sadece UUID'leri kullan
        this.selectedSideProducts = productIds.map(id => ({ id, name: id } as Product));
      }
    });
  }

  displayProductFn(product: Product): string {
    return product?.name || '';
  }

  /**
   * Product seçildi → chip listesine ekle + form'u güncelle
   */
  onSideProductSelected(product: Product): void {
    if (this.selectedSideProducts.find(p => p.id === product.id)) return;
    this.selectedSideProducts.push(product);
    this.form.patchValue({
      side_product_ids: this.selectedSideProducts.map(p => p.id),
      side_product_search: '',
    });
  }

  /**
   * Chip'ten çıkar
   */
  removeSideProduct(product: Product): void {
    this.selectedSideProducts = this.selectedSideProducts.filter(p => p.id !== product.id);
    this.form.patchValue({
      side_product_ids: this.selectedSideProducts.map(p => p.id),
    });
  }
  /**
   * Open dialog to add new company
   */
  openAddCompanyDialog(): void {
    const dialogRef = this.dialog.open(AddCompanyDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        mode: 'create'
      } as CompanyDialogData
    });

    dialogRef.afterClosed().subscribe((newCompany: Company | null) => {
      if (newCompany) {
        // Select the newly created company
        this.selectedCompany = newCompany;
        this.form.patchValue({
          target_company: newCompany.id,
          target_company_search: newCompany
        });

        this.toastService.success(this.translate.instant('CUSTOMER_MESSAGES.NEW_COMPANY_SELECTED'));
      }
    });
  }

  openEditCompanyDialog(): void {
    const dialogRef = this.dialog.open(AddCompanyDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        mode: 'edit',
        existingCompanies: [] // ← Backend'den arayacak, gerek yok
      } as CompanyDialogData
    });

    dialogRef.afterClosed().subscribe((updatedCompany: Company | null) => {
      if (updatedCompany) {
        // Update selected company if it's the one being edited
        if (this.selectedCompany?.id === updatedCompany.id) {
          this.selectedCompany = updatedCompany;
          this.form.patchValue({
            target_company_search: updatedCompany
          });
        }

        this.toastService.success(this.translate.instant('CUSTOMER_MESSAGES.COMPANY_UPDATED'));
      }
    });
  }

  /**
   * Get title based on mode
   */
  getTitle(): string {
    return this.data.mode === 'create' ? this.translate.instant('CUSTOMER.ADD_NEW') : this.translate.instant('COMMON.EDIT');
  }

  /**
   * Save form
   */
  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    this.isSaving = true;
    const formValue = this.form.value;

    // Extra data (mevcut)
    const extraData: any = { _schema_version: '1.0' };
    this.extraDataFields.forEach(field => {
      const value = formValue[field.key];
      if (value !== null && value !== undefined) {
        extraData[field.key] = value;
      }
    });



    const payload: CompanyRelationDto = {
      target_company: formValue.target_company,
      relation_type: formValue.relation_type,
      is_active: formValue.is_active,
      notes: formValue.notes || null,
      extra_data: extraData
    };

    const request$ = this.data.mode === 'create'
      ? this.companyRelationService.create(payload)
      : this.companyRelationService.update(this.data.relation!.id!, payload);

    request$.subscribe({
      next: (result) => {
        const message = this.data.mode === 'create'
          ? this.translate.instant('CUSTOMER_MESSAGES.CUSTOMER_ADDED')
          : this.translate.instant('CUSTOMER_MESSAGES.CUSTOMER_UPDATED');
        this.toastService.success(message, this.translate.instant('COMMON.SUCCESS'));
        this.dialogRef.close(result);
      },
      error: (error) => {
        if (error.error?.non_field_errors) {
          this.toastService.error(error.error.non_field_errors[0]);
        } else {
          this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.OPERATION_ERROR'));
        }
        this.isSaving = false;
      }
    });
  }

  /**
   * Close dialog
   */
  onCancel(): void {
    this.dialogRef.close(null);
  }
}
