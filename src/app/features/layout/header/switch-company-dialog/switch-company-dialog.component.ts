import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, startWith, takeUntil } from 'rxjs';

import { ToastService } from '@core/services/toast.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { Company } from '@app/features/interfaces/company.interface';
import { CompanyService } from '@app/features/services/company.service';
import { AuthService } from '@app/core/auth/services/auth.service';

@Component({
  selector: 'app-switch-company-dialog',
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
    TranslateModule,
  ],
  templateUrl: './switch-company-dialog.component.html',
  styleUrl: './switch-company-dialog.component.scss',
})
export class SwitchCompanyDialogComponent implements OnInit, OnDestroy {
  private readonly companyService = inject(CompanyService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<SwitchCompanyDialogComponent>);
  private readonly destroy$ = new Subject<void>();

  searchControl = new FormControl<string>('');
  searchResults: Company[] = [];
  switchingCompanyId: string | null = null;

  ngOnInit(): void {
    // Arama boşken de ilk 5 şirket gösterilir (startWith('')).
    this.searchControl.valueChanges
      .pipe(startWith(''), debounceTime(300), takeUntil(this.destroy$))
      .subscribe((value) => this.searchCompanies(value || ''));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private searchCompanies(term: string): void {
    this.companyService.getAll({ search: term, limit: 5 }).subscribe({
      next: (response: any) => {
        this.searchResults = response.results || [];
      },
      error: () => {
        this.searchResults = [];
      },
    });
  }

  selectCompany(company: Company): void {
    if (this.switchingCompanyId) return;
    this.switchingCompanyId = company.id;
    this.authService.switchCompany(company.id).subscribe({
      next: () => {
        this.toastService.success(
          this.translate.instant('HEADER.SWITCH_COMPANY_SUCCESS', { company: company.company_name })
        );
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.switchingCompanyId = null;
        this.toastService.error(
          getApiErrorMessage(error, this.translate.instant('HEADER.SWITCH_COMPANY_ERROR'))
        );
      },
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
