import { Component, inject } from '@angular/core';
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

@Component({
  selector: 'app-pallets',
  imports: [CommonModule,
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
export class PalletsComponent {

  private translate = inject(TranslateService);
  // Servis enjeksiyonları
  palletService = inject(PalletService);
  private dialog = inject(MatDialog);

  palletBulkConfig: BulkUploadConfig = createPalletBulkConfig();

  // Loading durumu
  isLoading = false;

  // API'den dönen verilerde product_type, dimension ve weight_type doğrudan
  // nesne olarak döndüğü için kolonları değişiyoruz
  displayedColumns: string[] = [
    'dimension.width',
    'dimension.depth',
    'dimension.height',
    'weight'
  ];

  // Filtrelenebilen alanlar
  filterableColumns: string[] = [
    'dimension.width',
    'dimension.height',
    'dimension.depth',
    'weight'
  ];

  // İlişkili nesne sütunları için özel görüntüleme ayarları
  nestedDisplayColumns: { [key: string]: string } = {
    'dimension.width': this.translate.instant('DIMENSIONS.WIDTH'),
    'dimension.height': this.translate.instant('CUSTOMER.MAX_PALLET_HEIGHT'),
    'dimension.depth': this.translate.instant('DIMENSIONS.DEPTH'),
    'weight': this.translate.instant('DIMENSIONS.WEIGHT')
  };

  ngOnInit(): void {
  }

  /**
   * Palet Grupları Dialog'unu aç
   */
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
      // Dialog kapandıktan sonra işlem yapılacaksa buraya eklenebilir
      if (result) {
        // Örneğin tabloyu yenile vs.
      }
    });
  }
}
