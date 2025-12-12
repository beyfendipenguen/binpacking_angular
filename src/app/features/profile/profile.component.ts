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
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog/forgot-password-dialog.component';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import { User } from '@app/core/interfaces/user.interface';
import { AppState, selectUser, loadUser } from '@app/store';
import { UserService } from '../auth/user.service';
import { CompanyService } from '../services/company.service';
import { Company } from '../interfaces/company.interface';
import { ToastService } from '@app/core/services/toast.service';

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
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService)
  private dialog = inject(MatDialog);
  private readonly store = inject(Store<AppState>);
  user$ = this.store.select(selectUser);
  private destroy$ = new Subject<void>();

  formChanged = false;
  changedFields: Partial<User> = {};
  companyFormChanged = false;
  changedCompanyFields: Partial<Company> = {};

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  companyForm!: FormGroup;
  userProfile: User | null = null;
  userCompany: Company | null = null;
  isLoading = false;
  isLoadingPicture = false;
  isLoadingCompanyLogo = false;
  isSavingCompany = false;
  profilePictureUrl = 'https://cdn-icons-png.flaticon.com/512/219/219986.png';
  companyLogoUrl = 'https://cdn-icons-png.flaticon.com/512/3588/3588592.png';
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
  ];
  selectedCountryCode = '+90';

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

      this.changedFields = {};
      const formValue = this.profileForm.value;

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

      const originalPhone = this.userProfile.phone || '';
      this.selectedCountryCode = formValue.countryCode || '+90';

      const formattedNewPhone = this.userService['formatPhoneNumber'](
        formValue.phone,
        this.selectedCountryCode
      );
      if (formattedNewPhone !== originalPhone) {
        this.changedFields.phone = formValue.phone;
      }

      this.formChanged = Object.keys(this.changedFields).length > 0;
    });
  }

  private trackCompanyFormChanges() {
    this.companyForm.valueChanges.subscribe(() => {
      if (!this.userCompany) return;

      this.changedCompanyFields = {};
      const formValue = this.companyForm.value;

      if (formValue.company_name !== this.userCompany.company_name) {
        this.changedCompanyFields.company_name = formValue.company_name;
      }

      if (formValue.country !== this.userCompany.country) {
        this.changedCompanyFields.country = formValue.country;
      }

      this.companyFormChanged = Object.keys(this.changedCompanyFields).length > 0;
    });
  }

  private initializeForms() {
    this.profileForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      countryCode: ['+90'],
      address: [''],
      company: [null],
    });

    this.passwordForm = this.fb.group(
      {
        old_password: ['', Validators.required],
        new_password: ['', [Validators.required, Validators.minLength(8)]],
        confirm_password: ['', Validators.required],
      },
      { validator: this.passwordMatchValidator }
    );

    this.companyForm = this.fb.group({
      company_name: ['', [Validators.required, Validators.minLength(2)]],
      country: ['', [Validators.required, Validators.minLength(2)]],
    });
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

    dialogRef.afterClosed().subscribe((result) => { });
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

          // Load company data
          if (user.company) {
            this.loadCompanyData(user.company);
          }
        }
        this.isLoading = false;
        this.trackFormChanges();
      },
      error: (error) => {
        this.isLoading = false;
        this.showError('Profil Yuklenirken hata olustu');
      },
    });
  }

  private loadCompanyData(company: any) {
    // If company is just an ID string
    if (typeof company === 'string') {
      this.companyService.getById(company).subscribe({
        next: (companyData) => {
          this.userCompany = companyData;
          this.patchCompanyForm(companyData);
          if (companyData.logo) {
            this.companyLogoUrl = companyData.logo;
          }
          this.trackCompanyFormChanges();
        },
        error: (error) => {
          this.showError('Şirket bilgileri yüklenirken hata oluştu');
        }
      });
    } else {
      // If company is already a full object
      this.userCompany = company;
      this.patchCompanyForm(company);
      if (company.logo) {
        this.companyLogoUrl = company.logo;
      }
      this.trackCompanyFormChanges();
    }
  }

  private patchCompanyForm(company: Company) {
    this.companyForm.patchValue({
      company_name: company.company_name || '',
      country: company.country || '',
    });
  }

  private patchProfileForm(user: User) {
    let phoneNumber = user.phone || '';
    let countryCode = '+90';

    if (phoneNumber && phoneNumber.startsWith('+')) {
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
      phone: phoneNumber,
      countryCode: countryCode,
      address: user.address || '',
      company: user.company,
    });
  }

  onUpdateProfile() {
    if (this.profileForm.invalid || !this.formChanged) return;

    this.isLoading = true;

    this.userService
      .updateChangedFields(this.changedFields, this.selectedCountryCode)
      .subscribe({
        next: (user) => {
          this.userProfile = user;
          this.isLoading = false;
          this.formChanged = false;
          this.changedFields = {};
          this.showSuccess('Profil bilgileri başarıyla güncellendi');
        },
        error: (error) => {
          this.isLoading = false;

          let errorMessage = 'Profil güncellenirken hata oluştu';

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

  onUpdateCompany() {
    if (this.companyForm.invalid || !this.companyFormChanged || !this.userCompany) return;

    this.isSavingCompany = true;

    this.companyService.partialUpdate(this.userCompany.id!, this.changedCompanyFields).subscribe({
      next: (updatedCompany) => {
        this.userCompany = updatedCompany;
        this.patchCompanyForm(updatedCompany);
        this.isSavingCompany = false;
        this.companyFormChanged = false;
        this.changedCompanyFields = {};
        this.showSuccess('Şirket bilgileri başarıyla güncellendi');
      },
      error: (error) => {
        this.isSavingCompany = false;

        let errorMessage = 'Şirket güncellenirken hata oluştu';

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
          this.showSuccess('Profil fotoğrafı başarıyla güncellendi');
        },
        error: (error) => {
          this.isLoadingPicture = false;
          this.showError('Profil fotoğrafı güncellenirken hata oluştu');
        },
      });
    }
  }

  onCompanyLogoSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.userCompany) {
      this.isLoadingCompanyLogo = true;

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('logo', file);

      // Use partialUpdate with FormData
      this.companyService.update(this.userCompany.id!, formData as any).subscribe({
        next: (updatedCompany) => {
          this.userCompany = updatedCompany;
          if (updatedCompany.logo) {
            this.companyLogoUrl = updatedCompany.logo;
          }
          this.isLoadingCompanyLogo = false;
          this.showSuccess('Şirket logosu başarıyla güncellendi');
        },
        error: (error) => {
          this.isLoadingCompanyLogo = false;
          this.showError('Şirket logosu güncellenirken hata oluştu');
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
        this.showSuccess('Parola başarıyla değiştirildi');
        this.passwordForm.reset();
      },
      error: (error) => {
        this.isLoading = false;

        let errorMessage = 'Parola değiştirilirken hata oluştu';

        if (error.error) {
          if (typeof error.error === 'object') {
            const errors: any = [];
            Object.entries(error.error).forEach(([field, messages]) => {
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
    let rawValue = input.value.replace(/[^0-9]/g, '');

    if (rawValue.startsWith('0')) {
      rawValue = rawValue.substring(1);
    }

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

    input.value = formattedValue;
    this.profileForm.get('phone')?.setValue(rawValue);
  }

  resetForm() {
    if (this.userProfile) {
      this.patchProfileForm(this.userProfile);
    }
  }

  resetCompanyForm() {
    if (this.userCompany) {
      this.patchCompanyForm(this.userCompany);
    }
  }

  getPasswordStrength(): string {
    const password = this.passwordForm.get('new_password')?.value || '';

    if (password.length === 0) return '';

    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    if (/[0-9]/.test(password)) strength++;

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;

    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return 'zayif';
    if (strength <= 4) return 'orta';
    return 'guclu';
  }

  private showSuccess(message: string) {
    this.toastService.success(message, 'Başarılı');
  }

  private showError(message: string) {
    this.toastService.error(message, 'Hata');
  }
}
