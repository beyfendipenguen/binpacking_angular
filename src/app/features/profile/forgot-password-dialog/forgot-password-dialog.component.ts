import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Component, inject, Optional, Inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from '@app/features/auth/user.service';

export interface ForgotPasswordDialogData {
  /**
   * Kullanıcı zaten giriş yapmış durumdaysa (Profile sayfasından açılıyorsa),
   * çağıran component kendi hesap e-postasını buraya verir. Verildiğinde
   * dialog e-posta ALANI GÖSTERMEZ — kullanıcı başka birinin e-postasına
   * sıfırlama maili tetikleyemesin diye e-posta girişi tamamen kapatılır,
   * doğrudan bu adrese gönderilir.
   * Giriş ekranından (signin) açılırken bu veri verilmez — o durumda
   * kullanıcı henüz kimliği bilinmediği için e-posta sormak zorunludur.
   */
  lockedEmail?: string;
}

@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    TranslateModule
  ],
  templateUrl: './forgot-password-dialog.component.html',
  styleUrl: './forgot-password-dialog.component.scss'
})
export class ForgotPasswordDialogComponent {

  private translate = inject(TranslateService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private userService = inject(UserService);
  dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>);

  resetForm: FormGroup;
  isLoading = false;
  emailSent = false;

  /** true ise e-posta alanı hiç gösterilmez, doğrudan lockedEmail'e gönderilir. */
  readonly isEmailLocked: boolean;
  readonly lockedEmail: string | null;

  constructor(@Optional() @Inject(MAT_DIALOG_DATA) data: ForgotPasswordDialogData | null) {
    this.lockedEmail = data?.lockedEmail || null;
    this.isEmailLocked = !!this.lockedEmail;

    this.resetForm = this.fb.group({
      email: [
        this.lockedEmail || '',
        this.isEmailLocked ? [] : [Validators.required, Validators.email]
      ]
    });

    if (this.isEmailLocked) {
      // Kullanıcı değiştiremesin diye alanı devre dışı bırakıyoruz —
      // template zaten input'u göstermiyor, bu ek bir güvenlik katmanı.
      this.resetForm.get('email')?.disable();
    }
  }

  get displayEmail(): string {
    return this.lockedEmail || this.resetForm.get('email')?.value || '';
  }

  sendResetEmail() {
    if (this.resetForm.invalid && !this.emailSent) return;

    this.isLoading = true;
    const email = this.lockedEmail || this.resetForm.get('email')?.value;

    this.userService.requestPasswordReset(email).subscribe({
      next: () => {
        this.isLoading = false;
        this.emailSent = true;
      },
      error: (error) => {
        this.isLoading = false;

        let errorMessage = this.translate.instant('PASSWORD.RESET_EMAIL_ERROR');

        if (error.error && typeof error.error === 'object') {
          const firstError = Object.entries(error.error).map(([field, messages]) => {
            return `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`;
          }).join('\n');
          errorMessage = firstError || errorMessage;
        } else if (error.error && typeof error.error === 'string') {
          errorMessage = error.error;
        }

        this.showError(errorMessage);
      }
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }
}
