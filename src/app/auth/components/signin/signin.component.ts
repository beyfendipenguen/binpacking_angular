import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatLabel } from '@angular/material/form-field';
import { AuthService } from '../../services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { ForgotPasswordDialogComponent } from '../../../admin/components/profile/forgot-password-dialog/forgot-password-dialog.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-signin',
  imports: [MatButton, MatFormField, MatInput, MatIcon, MatLabel, ReactiveFormsModule,MatCardModule],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent {

  hide = true;
  signinForm: FormGroup;
  private dialog = inject(MatDialog); // Dialog servisini inject edin

  constructor(
    public fb: FormBuilder,
    public authService: AuthService
  ) {
    this.signinForm = this.fb.group({
      username: [environment.production ? '' : '',[Validators.required]],
      password: [environment.production ? '' : '',[Validators.required]]
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

      });
    }
}
