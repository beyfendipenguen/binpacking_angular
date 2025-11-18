import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { User } from '../../../models/user.interface';
import { UserService } from '../../../services/user.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog/forgot-password-dialog.component';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { AppState, loadUser, selectUser } from '../../../store';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatTabsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatDialogModule,
    MatSelectModule,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog); // Dialog servisini inject edin
  private readonly store = inject(Store<AppState>);
  user$ = this.store.select(selectUser);
  private destroy$ = new Subject<void>();

  formChanged = false; // Form değişti mi?
  changedFields: Partial<User> = {}; // Değişen alanlar
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  userProfile: User | null = null;
  isLoading = false;
  isLoadingPicture = false;
  profilePictureUrl = 'https://cdn-icons-png.flaticon.com/512/219/219986.png';
  hidePassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  countryCodes = [
    { code: '+90', country: 'Türkiye' },
    { code: '+1', country: 'ABD/Kanada' },
    { code: '+44', country: 'Birleşik Krallık' },
    { code: '+49', country: 'Almanya' },
    { code: '+33', country: 'Fransa' },
    { code: '+39', country: 'İtalya' },
    { code: '+31', country: 'Hollanda' },
    { code: '+7', country: 'Rusya' },
    { code: '+86', country: 'Çin' },
    { code: '+81', country: 'Japonya' },
    // Diğer ülke kodları eklenebilir
  ];
  selectedCountryCode = '+90'; // Varsayılan olarak Türkiye kodu

  ngOnInit() {
    this.initializeForms();
    this.loadProfile();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private trackFormChanges() {
    this.profileForm.valueChanges.subscribe(() => {
      if (!this.userProfile) return;

      // Değişen alanları kontrol et
      this.changedFields = {};
      const formValue = this.profileForm.value;

      // Her alan için kontrol et
      if (formValue.first_name !== this.userProfile.first_name) {
        this.changedFields.first_name = formValue.first_name;
      }

      if (formValue.last_name !== this.userProfile.last_name) {
        this.changedFields.last_name = formValue.last_name;
      }

      if (formValue.username !== this.userProfile.username) {
        this.changedFields.username = formValue.username;
      }

      if (formValue.email !== this.userProfile.email) {
        this.changedFields.email = formValue.email;
      }

      if (formValue.address !== this.userProfile.address) {
        this.changedFields.address = formValue.address;
      }

      // Telefon için özel kontrol
      const originalPhone = this.userProfile.phone || '';
      this.selectedCountryCode = formValue.countryCode || '+90'; // Ülke kodunu sakla

      // Telefon numarasını ülke kodu ile birleştirip karşılaştırmak için format fonksiyonunu kullanalım
      const formattedNewPhone = this.userService['formatPhoneNumber'](
        formValue.phone,
        this.selectedCountryCode
      );
      if (formattedNewPhone !== originalPhone) {
        this.changedFields.phone = formValue.phone; // Yalnızca numarayı saklıyoruz
      }

      // Form değişti mi?
      this.formChanged = Object.keys(this.changedFields).length > 0;
    });
  }

  private initializeForms() {
    this.profileForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      countryCode: ['+90'], // Varsayılan ülke kodu
      address: [''],
      company: [null], // Company alanını ekleyelim
    });

    this.passwordForm = this.fb.group(
      {
        old_password: ['', Validators.required],
        new_password: ['', [Validators.required, Validators.minLength(8)]],
        confirm_password: ['', Validators.required],
      },
      { validator: this.passwordMatchValidator }
    );
  }

  private passwordMatchValidator(g: FormGroup) {
    return g.get('new_password')?.value === g.get('confirm_password')?.value
      ? null
      : { mismatch: true };
  }

  openForgotPasswordDialog() {
    const dialogRef = this.dialog.open(ForgotPasswordDialogComponent, {
      width: '400px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {});
  }

  loadProfile() {
    this.isLoading = true;
    this.store.dispatch(loadUser({}));

    this.user$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (user) => {
        this.userProfile = user;
        if (user) {
          this.patchProfileForm(user);
          if (user.profile_picture) {
            this.profilePictureUrl = user.profile_picture;
          }
        }
        this.isLoading = false;
        this.trackFormChanges();
      },
      error: (error) => {
        this.isLoading = false;
        this.showError('Error loading profile');
      },
    });
  }

  private patchProfileForm(user: User) {
    // Telefon numarasını ülke kodu ve numara olarak ayıralım
    let phoneNumber = user.phone || '';
    let countryCode = '+90'; // Varsayılan

    // Eğer telefon numarası bir ülke kodu ile başlıyorsa, ayırma işlemini yapalım
    if (phoneNumber && phoneNumber.startsWith('+')) {
      // Ülke kodunu belirleyelim
      const foundCode = this.countryCodes.find((c) =>
        phoneNumber.startsWith(c.code)
      );
      if (foundCode) {
        countryCode = foundCode.code;
        phoneNumber = phoneNumber.substring(foundCode.code.length);
      }
    }

    this.profileForm.patchValue({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      email: user.email || '',
      phone: phoneNumber, // Sadece telefon numarası
      countryCode: countryCode, // Ülke kodu
      address: user.address || '',
      company: user.company, // Tüm company nesnesini saklıyoruz
    });
  }

  onUpdateProfile() {
    if (this.profileForm.invalid || !this.formChanged) return;

    this.isLoading = true;

    // Sadece değişen alanları ve ülke kodunu ayrı parametre olarak gönder
    this.userService
      .updateChangedFields(this.changedFields, this.selectedCountryCode)
      .subscribe({
        next: (user) => {
          this.userProfile = user;
          this.isLoading = false;
          this.formChanged = false; // Değişiklikler kaydedildi
          this.changedFields = {}; // Değişen alanları temizle
          this.showSuccess('Profile updated successfully');
        },
        error: (error) => {
          this.isLoading = false;

          let errorMessage = 'Error updating profile';

          if (error.error) {
            if (typeof error.error === 'object') {
              const errors = Object.entries(error.error)
                .map(([field, messages]) => {
                  const messageText = Array.isArray(messages)
                    ? messages.join(', ')
                    : messages;
                  return `${field}: ${messageText}`;
                })
                .join('\n');

              if (errors) {
                errorMessage = errors;
              }
            } else if (typeof error.error === 'string') {
              errorMessage = error.error;
            }
          }

          this.showError(errorMessage);
        },
      });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isLoadingPicture = true;
      this.userService.updateProfilePicture(file).subscribe({
        next: (user) => {
          this.profilePictureUrl = user.profile_picture;
          this.isLoadingPicture = false;
          this.showSuccess('Profile picture updated successfully');
        },
        error: (error) => {
          this.isLoadingPicture = false;
          this.showError('Error updating profile picture');
        },
      });
    }
  }

  onChangePassword() {
    if (this.passwordForm.invalid) return;

    this.isLoading = true;
    const passwords = this.passwordForm.value;

    this.userService.changePassword(passwords).subscribe({
      next: () => {
        this.isLoading = false;
        this.showSuccess('Password changed successfully');
        this.passwordForm.reset();
      },
      error: (error) => {
        this.isLoading = false;

        let errorMessage = 'Error changing password';

        if (error.error) {
          // Check for field-specific errors
          if (typeof error.error === 'object') {
            const errors: any = [];
            Object.entries(error.error).forEach(([field, messages]) => {
              // Convert field names to user-friendly names
              let fieldName = field;
              switch (field) {
                case 'old_password':
                  fieldName = 'Current password';
                  break;
                case 'new_password':
                  fieldName = 'New password';
                  break;
                case 'confirm_password':
                  fieldName = 'Confirm password';
                  break;
                case 'error':
                  fieldName = '';
                  break;
                case 'message':
                  fieldName = '';
                  break;
              }

              const messageList = Array.isArray(messages)
                ? messages
                : [messages];
              messageList.forEach((msg) => {
                errors.push(fieldName ? `${fieldName}: ${msg}` : msg);
              });
            });

            if (errors.length > 0) {
              errorMessage = errors.join('\n');
            }
          } else if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          }
        }

        this.showError(errorMessage);
      },
    });
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // Sadece rakamları al
    let rawValue = input.value.replace(/[^0-9]/g, '');

    // İlk rakamı kontrol et, eğer 0 ise kaldır (ülke kodu kullanacağımız için)
    if (rawValue.startsWith('0')) {
      rawValue = rawValue.substring(1);
    }

    // Formatlanmış değeri oluştur (5XX XXX XX XX)
    let formattedValue = '';

    if (rawValue.length > 0) {
      formattedValue += rawValue.substring(0, Math.min(3, rawValue.length));
    }

    if (rawValue.length > 3) {
      formattedValue +=
        ' ' + rawValue.substring(3, Math.min(6, rawValue.length));
    }

    if (rawValue.length > 6) {
      formattedValue +=
        ' ' + rawValue.substring(6, Math.min(8, rawValue.length));
    }

    if (rawValue.length > 8) {
      formattedValue +=
        ' ' + rawValue.substring(8, Math.min(10, rawValue.length));
    }

    // Görüntülenen değeri formatlanmış şekilde ayarla
    input.value = formattedValue;

    // Form kontrolünün içeriğini sadece formatlanmamış rakamlar olarak ayarla
    this.profileForm.get('phone')?.setValue(rawValue);
  }

  resetForm() {
    if (this.userProfile) {
      this.patchProfileForm(this.userProfile);
    }
  }

  getPasswordStrength(): string {
    const password = this.passwordForm.get('new_password')?.value || '';

    if (password.length === 0) return '';

    let strength = 0;

    // Length
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    // Contains numbers
    if (/[0-9]/.test(password)) strength++;

    // Contains lowercase and uppercase
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;

    // Contains special characters
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }
}
