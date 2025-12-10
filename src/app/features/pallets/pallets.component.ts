import { Component, inject } from '@angular/core';
import { PalletService } from '../services/pallet.service';
import { BulkUploadConfig } from '@app/shared/bulk-upload-dialog/bulk-upload.config';
import { createPalletBulkConfig } from './config/pallet-bulk.config';
import { GenericTableComponent } from "@app/shared/generic-table/generic-table.component";
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BulkUploadButtonDirective } from '@app/shared/bulk-upload-dialog/bulk-upload-button.directive';

@Component({
  selector: 'app-pallets',
  imports: [CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule,
    BulkUploadButtonDirective],
  templateUrl: './pallets.component.html',
  styleUrl: './pallets.component.scss'
})
export class PalletsComponent {
  // Servis enjeksiyonları
  palletService = inject(PalletService);
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
    'dimension.width': 'Genişlik',
    'dimension.height': 'Yükseklik ( Palet üst sınırı )',
    'dimension.depth': 'Derinlik',
    'weight': 'Ağırlık'
  };

  ngOnInit(): void {
  }
}
