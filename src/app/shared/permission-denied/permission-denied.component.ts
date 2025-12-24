import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ContactAdminDialogComponent } from './contact-admin-dialog/contact-admin-dialog.component';
import { PermissionTranslatePipe } from './pipes/permission-translate.pipe';

@Component({
  selector: 'app-permission-denied',
  imports: [CommonModule, TranslateModule, MatButtonModule, MatIconModule,PermissionTranslatePipe],
  templateUrl: './permission-denied.component.html',
  styleUrl: './permission-denied.component.scss'
})
export class PermissionDeniedComponent {
  @Input() title?: string;
  @Input() message?: string;
  @Input() requiredPermissions: string[] = [];
  @Input() restrictedPermissions: string[] = [];
  @Input() showDetails = true;
  @Input() showContactButton = true;
  @Input() showBackButton = false;
  @Input() currentPage?: string;

  private dialog = inject(MatDialog);

  onContactAdmin() {
    const dialogRef = this.dialog.open(ContactAdminDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        requiredPermissions: this.requiredPermissions,
        restrictedPermissions: this.restrictedPermissions,
        currentPage: this.currentPage || window.location.pathname,
        timestamp: new Date().toISOString()
      },
      panelClass: 'contact-admin-dialog',
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        //TODO: MESAJ GONDERME DURUMU
      }
    });
  }

  onGoBack() {
    window.history.back();
  }
}
