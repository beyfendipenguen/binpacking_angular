import { Component, OnInit, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PalletService } from '../services/pallet.service';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { createPalletBulkConfig } from './config/pallet-bulk.config';
import { GenericTableComponent } from "@app/shared/generic-table/generic-table.component";
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BulkUploadButtonDirective } from '@app/shared/bulk-upload-dialog/bulk-upload-button.directive';
import { PalletGroupDialogComponent } from './pallet-group-dialog/pallet-group-dialog.component';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { ColumnDefinition } from '@app/shared/generic-table/interfaces/column-definition.interface';

@Component({
  selector: 'app-pallets',
  imports: [
    CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    BulkUploadButtonDirective,
    TranslateModule,
    DisableAuthDirective,
    HasPermissionDirective,
  ],
  templateUrl: './pallets.component.html',
  styleUrl: './pallets.component.scss'
})
export class PalletsComponent implements OnInit {
  private translate = inject(TranslateService);
  palletService = inject(PalletService);
  private dialog = inject(MatDialog);

  palletBulkConfig: BulkUploadConfig = createPalletBulkConfig();
  isLoading = false;

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'dimension.width',
      label: 'DIMENSIONS.WIDTH',
      type: 'number',
      required: true,
      min: 0,
      max: 99999,
      hint: 'mm'
    },
    {
      key: 'dimension.depth',
      label: 'DIMENSIONS.DEPTH',
      type: 'number',
      required: true,
      min: 0,
      max: 99999,
      hint: 'mm'
    },
    {
      key: 'dimension.height',
      label: 'CUSTOMER.MAX_PALLET_HEIGHT',
      type: 'number',
      required: true,
      min: 0,
      max: 99999,
      hint: 'mm'
    },
    {
      key: 'weight',
      label: 'DIMENSIONS.WEIGHT',
      type: 'number',
      required: true,
      min: 0,
      hint: 'kg'
    },
    {
      key: 'created_by',
      label: 'COMMON.USER',
      type: 'text',
      visible: false
    },
    {
      key: 'created_at',
      label: 'ORDER.CREATION_DATE',
      type: 'date',
      visible: false
    }
  ];

  displayedColumns: string[] = this.columnDefinitions.map(c => c.key);

  filterableColumns: string[] = this.columnDefinitions
    .filter(c => c.type === 'number')
    .map(c => c.key);

  columnTypes: { [key: string]: string } = {
    'created_at': 'date'
  };

  ngOnInit(): void {}

  openPalletGroupsDialog(): void {
    const dialogRef = this.dialog.open(PalletGroupDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      height: '80vh',
      maxHeight: '90vh',
      disableClose: false,
      panelClass: 'pallet-group-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {}
    });
  }
}
