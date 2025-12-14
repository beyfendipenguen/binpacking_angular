import { Component, OnInit, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CompanyService } from '../../../services/company.service';
import { ToastService } from '@app/core/services/toast.service';
import { Company } from '../../../interfaces/company.interface';

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
    MatProgressSpinnerModule
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

  constructor(
    public dialogRef: MatDialogRef<AddCompanyDialogComponent>
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  /**
   * Initialize form
   */
  private initForm(): void {
    this.form = this.fb.group({
      company_name: ['', [Validators.required, Validators.minLength(2)]],
      country: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  /**
   * Save new company
   */
  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    this.isSaving = true;

    const companyData: Partial<Company> = {
      company_name: this.form.value.company_name,
      country: this.form.value.country
    };

    this.companyService.create(companyData).subscribe({
      next: (createdCompany: Company) => {
        this.toastService.success(this.translate.instant('CUSTOMER_MESSAGES.COMPANY_ADDED'));
        this.dialogRef.close(createdCompany);
      },
      error: (error) => {
        if (error.error?.company_name) {
          this.toastService.error(error.error.company_name[0]);
        } else if (error.error?.country) {
          this.toastService.error(error.error.country[0]);
        } else {
          this.toastService.error(this.translate.instant('CUSTOMER_MESSAGES.COMPANY_ADD_ERROR'));
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
