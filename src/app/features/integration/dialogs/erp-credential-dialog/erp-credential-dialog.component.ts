import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@app/core/services/toast.service';
import { ErpIntegrationService } from '@app/features/services/erp-integration.service';
import { ErpCredential } from '@app/features/interfaces/erp-integration.interface';

/**
 * Backend'de kayıtlı connector'lar (bkz. ERPConnectorFactory._registry).
 * Burada seçilemez — SADECE erp_type'ı kullanıcıya görüntülerken (dostça
 * bir etiket göstermek için) kullanılıyor. Hangi connector'ın atandığına
 * admin panelinden karar verilir (bkz. ERPCredentialWriteSerializer
 * docstring'i — tenant kendi başına connector tipi seçemez/değiştiremez).
 * Yeni bir connector eklendiğinde (bkz.
 * documents_md/erp_new_connector_checklist.md) buraya da bir satır
 * eklenmeli, aksi halde etiket yerine ham erp_type değeri gösterilir.
 */
const ERP_TYPE_LABELS: Record<string, string> = {
  mock: 'Mock ERP (Test)',
  sanica: 'Sanica (Uyum ERP)',
};

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

  isLoading = signal(false);
  isSaving = signal(false);
  credential: ErpCredential | null = null;

  form!: FormGroup;

  constructor(public dialogRef: MatDialogRef<ErpCredentialDialogComponent>) {}

  ngOnInit(): void {
    this.form = this.fb.group({
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
        if (credential.is_configured) {
          this.form.patchValue({
            is_active: credential.is_active,
            settings_json: JSON.stringify(credential.settings || {}, null, 2),
          });
        }
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

  /** Admin'in atadığı erp_type için dostça etiket — yoksa ham değeri gösterir. */
  erpTypeLabel(): string {
    const type = this.credential?.erp_type;
    if (!type) return '';
    return ERP_TYPE_LABELS[type] || type;
  }

  onSave(): void {
    if (!this.credential?.is_configured) {
      // erp_type admin tarafından atanmadan secret/settings girilecek bir
      // bağlam yok — kaydet butonu zaten template'te devre dışı, bu ek bir
      // güvenlik önlemi.
      return;
    }

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

    const { is_active, secret_username, secret_password, secret_api_key } = this.form.value;

    this.erpService
      .updateMyCredential({
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
