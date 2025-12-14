import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatLabel } from '@angular/material/form-field';
import { AuthService } from '../../../core/auth/services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { ForgotPasswordDialogComponent } from '@features/profile/forgot-password-dialog/forgot-password-dialog.component';
import { LanguageService } from '@app/core/services/language.service'; // ✅ Ekle

@Component({
  selector: 'app-signin',
  imports: [
    MatButton,
    MatFormField,
    MatInput,
    MatIcon,
    MatLabel,
    ReactiveFormsModule,
    MatCardModule,
    TranslateModule
  ],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent {
  hide = true;
  signinForm: FormGroup;

  private dialog = inject(MatDialog);
  private languageService = inject(LanguageService); // ✅ Ekle - Service'i inject et

  constructor(
    public fb: FormBuilder,
    public authService: AuthService
  ) {
    // ✅ Service inject edildiğinde constructor çalışır ve dil ayarlanır

    this.signinForm = this.fb.group({
      username: [environment.production ? '' : 'muhammed', [Validators.required]],
      password: [environment.production ? '' : '1911Ahmet.', [Validators.required]]
    });
  }

  loginUser() {
    this.authService.signIn(this.signinForm.value);
  }

  openForgotPasswordDialog() {
    const dialogRef = this.dialog.open(ForgotPasswordDialogComponent, {
      width: '400px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle result
    });
  }
}
