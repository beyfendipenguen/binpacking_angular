import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ContractWarningData {
  daysLeft: number;
  contractEndDate: string;
}

@Component({
  selector: 'app-contract-warning-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
  ],
  templateUrl: './contract-warning-dialog.component.html',
  styleUrl: './contract-warning-dialog.component.scss',
})
export class ContractWarningDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ContractWarningDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ContractWarningData
  ) {}
}
