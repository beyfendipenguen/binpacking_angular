import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@app/core/services/toast.service';
import { ErpIntegrationService } from '@app/features/services/erp-integration.service';
import { ErpCredential } from '@app/features/interfaces/erp-integration.interface';

/**
 * Backend'de kayıtlı connector'lar (bkz. ERPConnectorFactory._registry).
 * Yeni bir connector eklendiğinde (bkz. documents_md/erp_new_connector_checklist.md)
 * buraya da bir satır eklenmeli, aksi halde kullanıcı seçemez.
 */
const ERP_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'mock', label: 'Mock ERP (Test)' },
];

@Component({
  selector: 'app-erp-credential-dialog',
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
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './erp-credential-dialog.component.html',
  styleUrl: './erp-credential-dialog.component.scss',
})
export class ErpCredentialDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private erpService = inject(ErpIntegrationService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);

  erpTypeOptions = ERP_TYPE_OPTIONS;

  isLoading = signal(false);
  isSaving = signal(false);
  credential: ErpCredential | null = null;

  form!: FormGroup;

  constructor(public dialogRef: MatDialogRef<ErpCredentialDialogComponent>) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      erp_type: ['mock', Validators.required],
      is_active: [true],
      settings_json: ['{}'],
      secret_username: [''],
      secret_password: [''],
      secret_api_key: [''],
    });
    this.loadCredential();
  }

  private loadCredential(): void {
    this.isLoading.set(true);
    this.erpService.getMyCredential().subscribe({
      next: (credential) => {
        this.credential = credential;
        this.form.patchValue({
          erp_type: credential.erp_type || 'mock',
          is_active: credential.is_configured ? credential.is_active : true,
          settings_json: JSON.stringify(credential.settings || {}, null, 2),
        });
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.error(this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        this.isLoading.set(false);
      },
    });
  }

  /** secrets_configured'a göre "tanımlı" ipucu — hiçbir zaman gerçek değeri göstermez. */
  isSecretConfigured(key: 'username' | 'password' | 'api_key'): boolean {
    return !!this.credential?.secrets_configured?.[key];
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    let settings: Record<string, any>;
    try {
      settings = JSON.parse(this.form.value.settings_json || '{}');
    } catch {
      this.toastService.error(this.translate.instant('INTEGRATION.INVALID_SETTINGS_JSON'));
      return;
    }

    this.isSaving.set(true);

    const { erp_type, is_active, secret_username, secret_password, secret_api_key } = this.form.value;

    this.erpService
      .updateMyCredential({
        erp_type,
        is_active,
        settings,
        secret_username,
        secret_password,
        secret_api_key,
      })
      .subscribe({
        next: () => {
          this.toastService.success(this.translate.instant('INTEGRATION.CREDENTIAL_SAVED'));
          this.dialogRef.close(true);
        },
        error: () => {
          this.toastService.error(this.translate.instant('INTEGRATION.CREDENTIAL_SAVE_ERROR'));
          this.isSaving.set(false);
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
