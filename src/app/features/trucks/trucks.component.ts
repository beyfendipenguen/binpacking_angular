import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GenericTableComponent } from '@app/shared/generic-table/generic-table.component';
import { TruckService } from '../services/truck.service';

@Component({
  selector: 'app-trucks',
    imports: [CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule],
  templateUrl: './trucks.component.html',
  styleUrl: './trucks.component.scss'
})
export class TrucksComponent {

  truckService = inject(TruckService)
  // Loading durumu
  isLoading = false;

  // API'den dönen verilerde product_type, dimension ve weight_type doğrudan
  // nesne olarak döndüğü için kolonları değişiyoruz
  displayedColumns: string[] = [
    'name',
    'dimension.width',
    'dimension.depth',
    'dimension.height',

  ];

  // Filtrelenebilen alanlar
  filterableColumns: string[] = [
    'name',
    'dimension.width',
    'dimension.height',
    'dimension.depth',
  ];

  // İlişkili nesne sütunları için özel görüntüleme ayarları
  nestedDisplayColumns: { [key: string]: string } = {
    'name': 'Sevkiyat Aracı Tipi',
    'dimension.width': 'Uzunluk',
    'dimension.height': 'Yükseklik',
    'dimension.depth': 'Genişlik'
  };

  ngOnInit(): void {
  }
}
