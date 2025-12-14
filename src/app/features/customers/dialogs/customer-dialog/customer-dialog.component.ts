import { Component, Inject, OnInit, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
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
import { Router } from '@angular/router';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { CompanyService } from '../../../services/company.service';
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
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AddCompanyDialogComponent } from '../add-company-dialog/add-company-dialog.component';

export interface CustomerDialogData {
  mode: 'create' | 'edit';
  relation?: CompanyRelation;
}

@Component({
  selector: 'app-customer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule
  ],
  templateUrl: './customer-dialog.component.html',
  styleUrl: './customer-dialog.component.scss'
})
export class CustomerDialogComponent implements OnInit {

  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private companyRelationService = inject(CompanyRelationService);
  private palletGroupService = inject(PalletGroupService);
  private toastService = inject(ToastService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  form!: FormGroup;
  isLoading = false;
  isSaving = false;
  relationTypeOptions = RELATION_TYPE_OPTIONS;

  // Company autocomplete
  companies: Company[] = [];
  filteredCompanies$!: Observable<Company[]>;
  selectedCompany: Company | null = null;

  // Pallet Groups
  palletGroups: PalletGroup[] = [];
  isLoadingPalletGroups = false;

  constructor(
    public dialogRef: MatDialogRef<CustomerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CustomerDialogData
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadCompanies();
    this.loadPalletGroups();
    this.setupCompanyAutocomplete();

    // Edit mode ise formu doldur
    if (this.data.mode === 'edit' && this.data.relation) {
      this.populateForm(this.data.relation);
    }
  }

  /**
   * Initialize form
   */
  private initForm(): void {
    const defaults = createDefaultCompanyRelation();

    this.form = this.fb.group({
      // Company selection
      target_company: [null, Validators.required],
      target_company_search: [''], // For autocomplete

      // Relation details
      relation_type: [defaults.relation_type, Validators.required],
      is_active: [defaults.is_active],
      notes: [defaults.notes],

      // Extra data fields
      is_multi_pallet: [defaults.extra_data?.is_multi_pallet],
      max_pallet_height: [defaults.extra_data?.max_pallet_height, [Validators.required, Validators.min(1)]],
      truck_weight_limit: [defaults.extra_data?.truck_weight_limit, [Validators.required, Validators.min(1)]],
      default_pallet_group_id: [defaults.extra_data?.default_pallet_group_id]
    });
  }

  /**
   * Load available companies from existing relations
   */
  private loadCompanies(): void {
    this.isLoading = true;
    this.companyRelationService.getAll({ limit: 1000 }).subscribe({
      next: (page) => {
        // Extract unique target companies
        const companyMap = new Map<string, Company>();
        page.results.forEach(relation => {
          if (relation.target_company && relation.target_company.id) {
            companyMap.set(relation.target_company.id, relation.target_company);
          }
        });
        this.companies = Array.from(companyMap.values());
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.COMPANIES_LOAD_ERROR'));
        this.isLoading = false;
      }
    });
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
    // Dialog'u kapat
    this.dialogRef.close(null);

    // Pallet groups sayfasına yönlendir
    this.router.navigate(['/pallet-groups']);
  }

  /**
   * Setup company autocomplete filter
   */
  private setupCompanyAutocomplete(): void {
    this.filteredCompanies$ = this.form.get('target_company_search')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        const searchValue = typeof value === 'string' ? value : value?.company_name || '';
        return this._filterCompanies(searchValue);
      })
    );
  }

  /**
   * Filter companies based on search term
   */
  private _filterCompanies(value: string): Company[] {
    const filterValue = value.toLowerCase();
    return this.companies.filter(company =>
      company.company_name.toLowerCase().includes(filterValue) ||
      company.country.toLowerCase().includes(filterValue)
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

    this.form.patchValue({
      target_company: relation.target_company.id,
      target_company_search: relation.target_company,
      relation_type: relation.relation_type,
      is_active: relation.is_active,
      notes: relation.notes,
      is_multi_pallet: relation.extra_data?.is_multi_pallet ?? false,
      max_pallet_height: relation.extra_data?.max_pallet_height ?? 2400,
      truck_weight_limit: relation.extra_data?.truck_weight_limit ?? 25000,
      default_pallet_group_id: relation.extra_data?.default_pallet_group_id ?? null
    });
  }

  /**
   * Open dialog to add new company
   */
  openAddCompanyDialog(): void {
    const dialogRef = this.dialog.open(AddCompanyDialogComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((newCompany: Company | null) => {
      if (newCompany) {
        // Add new company to list
        this.companies.push(newCompany);

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

  /**
   * Get title based on mode
   */
  getTitle(): string {
    return this.data.mode === 'create' ? this.translate.instant('CUSTOMER.ADD_NEW') : this.translate.instant('CUSTOMER.EDIT');
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
    const payload: CompanyRelationDto = {
      target_company: formValue.target_company,
      relation_type: formValue.relation_type,
      is_active: formValue.is_active,
      notes: formValue.notes || null,
      extra_data: {
        _schema_version: '1.0',
        is_multi_pallet: formValue.is_multi_pallet,
        max_pallet_height: formValue.max_pallet_height,
        truck_weight_limit: formValue.truck_weight_limit,
        default_pallet_group_id: formValue.default_pallet_group_id || null
      }
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
