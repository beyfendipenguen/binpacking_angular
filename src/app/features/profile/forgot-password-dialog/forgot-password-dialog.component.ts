import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from '@app/features/auth/user.service';

@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    MatSnackBarModule
  ],
  templateUrl: './forgot-password-dialog.component.html',
  styleUrl: './forgot-password-dialog.component.scss'
})
export class ForgotPasswordDialogComponent {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private userService = inject(UserService);
  dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>);

  resetForm: FormGroup;
  isLoading = false;
  emailSent = false;

  constructor() {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  sendResetEmail() {
    if (this.resetForm.invalid && !this.emailSent) return;

    this.isLoading = true;
    const email = this.resetForm.get('email')?.value;

    this.userService.requestPasswordReset(email).subscribe({
      next: () => {
        this.isLoading = false;
        this.emailSent = true;
      },
      error: (error) => {
        this.isLoading = false;

        let errorMessage = 'Şifre sıfırlama e-postası gönderilemedi';

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
