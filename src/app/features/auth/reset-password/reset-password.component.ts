import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { UserService } from '../user.service';
import { ToastService } from '@app/core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatProgressBarModule,
    TranslateModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService)

  // Form state
  resetForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;

  // Page state
  isValidating = true;
  isValidToken = false;
  isResetSuccessful = false;
  isLoading = false;

  // Token data
  uidb64: string | null = null;
  token: string | null = null;

  constructor() {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Extract token and uidb64 from URL
    this.route.params.subscribe(params => {
      this.uidb64 = params['uidb64'];
      this.token = params['token'];

      if (this.uidb64 && this.token) {
        this.validateToken();
      } else {
        this.isValidating = false;
        this.isValidToken = false;
      }
    });
  }

  getPasswordStrength(): string {
    const password = this.resetForm.get('password')?.value;
    if (!password) return 'weak';

    const hasNumbers = /\d/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const strength =
      (password.length >= 8 ? 1 : 0) +
      (hasNumbers ? 1 : 0) +
      (hasUppercase ? 1 : 0) +
      (hasLowercase ? 1 : 0) +
      (hasSpecial ? 1 : 0);

    if (strength >= 4) return this.translate.instant('AUTH.PASSWORD_STRENGTH_STRONG');
    if (strength >= 3) return this.translate.instant('AUTH.PASSWORD_STRENGTH_MEDIUM');
    return this.translate.instant('AUTH.PASSWORD_STRENGTH_WEAK');
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    if (strength === 'strong') return this.translate.instant('AUTH.PASSWORD_STRENGTH_STRONG');
    if (strength === 'medium') return this.translate.instant('AUTH.PASSWORD_STRENGTH_MEDIUM');
    return this.translate.instant('AUTH.PASSWORD_STRENGTH_WEAK');
  }

  getStrengthIcon(): string {
    const strength = this.getPasswordStrength();
    if (strength === 'strong') return 'shield';
    if (strength === 'medium') return 'security';
    return 'lock_open';
  }

  getStrengthBarWidth(): string {
    const strength = this.getPasswordStrength();
    if (strength === 'strong') return '100%';
    if (strength === 'medium') return '66%';
    return '33%';
  }

  validateToken() {
    this.isValidating = true;

    if (this.uidb64 && this.token) {
      this.userService.validatePasswordResetToken(this.uidb64, this.token).subscribe({
        next: () => {
          this.isValidating = false;
          this.isValidToken = true;
        },
        error: () => {
          this.isValidating = false;
          this.isValidToken = false;
        }
      });
    } else {
      this.isValidating = false;
      this.isValidToken = false;
    }
  }

  resetPassword() {
    if (this.resetForm.invalid) return;

    this.isLoading = true;
    const newPassword = this.resetForm.get('password')?.value;

    if (this.uidb64 && this.token) {
      this.userService.resetPassword(this.uidb64, this.token, newPassword).subscribe({
        next: () => {
          this.isLoading = false;
          this.isResetSuccessful = true;
        },
        error: (error) => {
          this.isLoading = false;

          let errorMessage = this.translate.instant('AUTH.RESET_FAILED');

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
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  private showError(message: string) {
    this.toastService.error(message, this.translate.instant('AUTH.CLOSE'));
  }
}
