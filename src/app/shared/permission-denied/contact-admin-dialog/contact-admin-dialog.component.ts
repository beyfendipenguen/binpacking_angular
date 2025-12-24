import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ToastService } from '@app/core/services/toast.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PermissionTranslatePipe } from '../pipes/permission-translate.pipe';

export interface PermissionRequestData {
  requiredPermissions: string[];
  restrictedPermissions: string[];
  currentPage: string;
  timestamp?: string;
}

@Component({
  selector: 'app-contact-admin',
  imports: [CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslateModule,
    PermissionTranslatePipe
  ],
  templateUrl: './contact-admin-dialog.component.html',
  styleUrl: './contact-admin-dialog.component.scss'
})
export class ContactAdminDialogComponent {
private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private dialogRef = inject(MatDialogRef<ContactAdminDialogComponent>);
  private translate = inject(TranslateService);
  isSubmitting = false;

  contactForm: FormGroup = this.fb.group({
    subjectType: ['permission_request', Validators.required],
    subject: ['', [Validators.required, Validators.minLength(5)]],
    priority: ['medium', Validators.required],
    message: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]],
    contactEmail: ['', [Validators.email]]
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PermissionRequestData
  ) {}

  get hasPermissionData(): boolean {
    return this.data && (
      (this.data.requiredPermissions?.length > 0) ||
      (this.data.restrictedPermissions?.length > 0)
    );
  }

  ngOnInit() {
    if (this.hasPermissionData) {
      this.prefillForm();
    }
  }

  private prefillForm() {
    const { requiredPermissions, restrictedPermissions, currentPage } = this.data;

    const subject = this.generateSubject(requiredPermissions, currentPage);
    const message = this.generateMessage(requiredPermissions, restrictedPermissions, currentPage);

    this.contactForm.patchValue({
      subjectType: 'permission_request',
      subject: subject,
      priority: 'medium',
      message: message
    });
  }

  private generateSubject(permissions: string[], page: string): string {
    if (!permissions || permissions.length === 0) {
      return this.translate.instant('CONTACT_ADMIN.PERMISSION_REQUEST');
    }

    const mainPermission = permissions[0];
    const pageName = this.getPageNameFromPermission(mainPermission);

    return `${pageName} - ${this.translate.instant('CONTACT_ADMIN.PERMISSION_REQUEST')}`;
  }

  private generateMessage(
    requiredPermissions: string[],
    restrictedPermissions: string[],
    currentPage: string
  ): string {
    let message = `${this.translate.instant('PERMISSION.MESSAGES.HELLO')},\n\n`;
    message += `"${currentPage}:" ${this.translate.instant('PERMISSION.MESSAGES.REQUEST')}\n\n`;

    if (requiredPermissions?.length > 0) {
      message += `${this.translate.instant('PERMISSION.REQUIRED')}:\n`;
      requiredPermissions.forEach(perm => {
        message += `• ${perm}\n`;
      });
      message += `\n`;
    }

    if (restrictedPermissions?.length > 0) {
      message += `${this.translate.instant('PERMISSION.RESTRICTED')}:\n`;
      restrictedPermissions.forEach(perm => {
        message += `• ${perm}\n`;
      });
      message += `\n`;
    }

    message += `${this.translate.instant('PERMISSION.MESSAGES.THANKS')}`;

    return message;
  }

  private getPageNameFromPermission(permission: string): string {
    const mapping: { [key: string]: string } = {
      'orders': this.translate.instant('PERMISSION.MODELS.ORDERS'),
      'packages': this.translate.instant('PERMISSION.MODELS.PACKAGES'),
      'trucks': this.translate.instant('PERMISSION.MODELS.TRUCKS'),
    };

    const app = permission.split('.')[0];
    return mapping[app] || this.translate.instant('COMMON.PAGE');
  }

  onSubmit() {
    if (this.contactForm.valid) {
      this.isSubmitting = true;

      const formData = {
        ...this.contactForm.value,
        permissionDetails: this.data
      };

      // Simüle edilmiş API çağrısı
      setTimeout(() => {

        this.toastService.success(
          this.translate.instant('PERMISSION.MESSAGE.SUCCESS')
        );

        this.isSubmitting = false;

        // Dialog'u kapat
        this.dialogRef.close({ success: true });
      }, 1500);
    }
  }

  onCancel() {
    if (this.contactForm.dirty) {
      const confirmed = confirm(this.translate.instant('PERMISSION.MESSAGE.ARE_YOU_SURE'));
      if (confirmed) {
        this.dialogRef.close({ success: false });
      }
    } else {
      this.dialogRef.close({ success: false });
    }
  }
}
