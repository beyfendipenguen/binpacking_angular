import { Component, OnInit, inject, Inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CompanyService } from '../../../services/company.service';
import { ToastService } from '@app/core/services/toast.service';
import { Company } from '../../../interfaces/company.interface';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface CompanyDialogData {
  mode: 'create' | 'edit';
  existingCompanies?: Company[];
}

@Component({
  selector: 'app-add-company-dialog',
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
    MatAutocompleteModule,
    TranslateModule,
    MatTooltipModule
  ],
  templateUrl: './add-company-dialog.component.html',
  styleUrl: './add-company-dialog.component.scss'
})
export class AddCompanyDialogComponent implements OnInit {

  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private companyService = inject(CompanyService);
  private toastService = inject(ToastService);

  form!: FormGroup;
  isSaving = false;
  isUploadingLogo = false;

  // Edit mode için
  selectedCompany: Company | null = null;
  filteredCompanies$!: Observable<Company[]>;

  // Logo preview
  logoPreviewUrl: string | null = null;
  selectedLogoFile: File | null = null;

  constructor(
    public dialogRef: MatDialogRef<AddCompanyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CompanyDialogData
  ) { }

  ngOnInit(): void {
    this.initForm();

    if (this.data.mode === 'edit') {
      this.setupCompanyAutocomplete();
    }
  }

  /**
   * Initialize form
   */
  private initForm(): void {
    this.form = this.fb.group({
      company_search: [''], // Edit mode için autocomplete
      company_name: ['', [Validators.required, Validators.minLength(2)]],
      country: ['', [Validators.required, Validators.minLength(2)]]
    });

    // Create modunda company_search gerekmez
    if (this.data.mode === 'create') {
      this.form.get('company_search')?.clearValidators();
      this.form.get('company_search')?.updateValueAndValidity();
    }
  }

  /**
   * Setup company autocomplete for edit mode
   */
  private setupCompanyAutocomplete(): void {
    this.filteredCompanies$ = this.form.get('company_search')!.valueChanges.pipe(
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
    if (!this.data.existingCompanies) return [];

    const filterValue = value.toLowerCase();
    return this.data.existingCompanies.filter(company =>
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
   * Handle company selection in edit mode
   */
  onCompanySelected(company: Company): void {
    this.selectedCompany = company;

    // Form'u doldur
    this.form.patchValue({
      company_name: company.company_name,
      country: company.country
    });

    // Logo preview'ı ayarla
    if (company.logo) {
      this.logoPreviewUrl = company.logo;
    } else {
      this.logoPreviewUrl = null;
    }

    this.selectedLogoFile = null;
  }

  /**
   * Clear selected company
   */
  clearSelectedCompany(): void {
    this.selectedCompany = null;
    this.logoPreviewUrl = null;
    this.selectedLogoFile = null;
    this.form.patchValue({
      company_search: '',
      company_name: '',
      country: ''
    });
  }

  /**
   * Handle logo file selection
   */
  onLogoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.INVALID_IMAGE_TYPE'));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.IMAGE_TOO_LARGE'));
        return;
      }

      this.selectedLogoFile = file;

      // Preview the image
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.logoPreviewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Remove logo
   */
  removeLogo(): void {
    this.selectedLogoFile = null;
    this.logoPreviewUrl = null;

    // Clear file input
    const fileInput = document.getElementById('logo-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  /**
   * Trigger file input click
   */
  triggerFileInput(): void {
    const fileInput = document.getElementById('logo-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Get dialog title based on mode
   */
  getTitle(): string {
    return this.data.mode === 'create'
      ? this.translate.instant('CUSTOMER.NEW_COMPANY_DIALOG_TITLE')
      : this.translate.instant('CUSTOMER.EDIT_COMPANY_DIALOG_TITLE');
  }

  /**
   * Get save button text based on mode
   */
  getSaveButtonText(): string {
    return this.data.mode === 'create'
      ? this.translate.instant('COMMON.ADD')
      : this.translate.instant('COMMON.UPDATE');
  }

  /**
   * Save or update company
   */
  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    // Edit modunda company seçilmemiş ise
    if (this.data.mode === 'edit' && !this.selectedCompany) {
      this.toastService.error(this.translate.instant('CUSTOMER.SELECT_COMPANY_TO_EDIT'));
      return;
    }

    this.isSaving = true;

    if (this.data.mode === 'create') {
      this.createCompany();
    } else {
      this.updateCompany();
    }
  }

  /**
   * Create new company
   */
  private createCompany(): void {
    const formData = new FormData();
    formData.append('company_name', this.form.value.company_name);
    formData.append('country', this.form.value.country);

    if (this.selectedLogoFile) {
      formData.append('logo', this.selectedLogoFile);
    }

    this.companyService.create(formData as any).subscribe({
      next: (createdCompany: Company) => {
        this.toastService.success(this.translate.instant('CUSTOMER_MESSAGES.COMPANY_ADDED'));
        this.dialogRef.close(createdCompany);
      },
      error: (error) => {
        this.handleError(error);
        this.isSaving = false;
      }
    });
  }

  /**
   * Update existing company
   */
  private updateCompany(): void {
    if (!this.selectedCompany) return;

    // Değişiklikleri kontrol et
    const hasNameChanged = this.form.value.company_name !== this.selectedCompany.company_name;
    const hasCountryChanged = this.form.value.country !== this.selectedCompany.country;
    const hasLogoChanged = this.selectedLogoFile !== null;

    // Hiçbir değişiklik yoksa uyarı ver
    if (!hasNameChanged && !hasCountryChanged && !hasLogoChanged) {
      this.toastService.info(this.translate.instant('CUSTOMER_MESSAGES.NO_CHANGES_MADE'));
      return;
    }

    this.isSaving = true;

    const formData = new FormData();

    // Sadece değişen alanları gönder
    if (hasNameChanged) {
      formData.append('company_name', this.form.value.company_name);
    }

    if (hasCountryChanged) {
      formData.append('country', this.form.value.country);
    }

    if (hasLogoChanged) {
      formData.append('logo', this.selectedLogoFile!);
    }

    // PATCH isteği için partialUpdate kullan
    this.companyService.partialUpdate(this.selectedCompany.id, formData as any).subscribe({
      next: (updatedCompany: Company) => {
        this.toastService.success(this.translate.instant('CUSTOMER_MESSAGES.COMPANY_UPDATED'));
        this.dialogRef.close(updatedCompany);
      },
      error: (error) => {
        this.handleError(error);
        this.isSaving = false;
      }
    });
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): void {
    if (error.error?.company_name) {
      this.toastService.error(error.error.company_name[0]);
    } else if (error.error?.country) {
      this.toastService.error(error.error.country[0]);
    } else if (error.error?.logo) {
      this.toastService.error(error.error.logo[0]);
    } else {
      const message = this.data.mode === 'create'
        ? this.translate.instant('CUSTOMER_MESSAGES.COMPANY_ADD_ERROR')
        : this.translate.instant('CUSTOMER_MESSAGES.COMPANY_UPDATE_ERROR');
      this.toastService.error(message);
    }
  }

  /**
   * Close dialog
   */
  onCancel(): void {
    this.dialogRef.close(null);
  }
}
