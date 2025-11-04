import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-cancel-confirmation-dialog',
  imports: [
    MatDialogModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './cancel-confirmation-dialog.component.html',
  styleUrl: './cancel-confirmation-dialog.component.scss'
})
export class CancelConfirmationDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<CancelConfirmationDialogComponent>
  ) {}

  onNoClick(): void {
    this.dialogRef.close(false);
  }

  onYesClick(): void {
    this.dialogRef.close(true);
  }
}
