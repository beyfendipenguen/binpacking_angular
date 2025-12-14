import { Component, Inject, Input, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface DialogData {
  header: string;      // Translation key
  title: string;       // Translation key
  info: string;        // Translation key
  confirmButtonText: string; // Translation key
  showYesButton: boolean;
  rejectButtonText: string;  // Translation key
}

@Component({
  selector: 'app-cancel-confirmation-dialog',
  imports: [
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule
  ],
  templateUrl: './cancel-confirmation-dialog.component.html',
  styleUrl: './cancel-confirmation-dialog.component.scss'
})
export class CancelConfirmationDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<CancelConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) { }

onNoClick(): void {
  this.dialogRef.close(false);
}

onYesClick(): void {
  this.dialogRef.close(true);
}
}
