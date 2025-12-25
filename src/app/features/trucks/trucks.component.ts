import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GenericTableComponent } from '@app/shared/generic-table/generic-table.component';
import { TruckService } from '../services/truck.service';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';

@Component({
  selector: 'app-trucks',
  imports: [CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    HasPermissionDirective
  ],
  templateUrl: './trucks.component.html',
  styleUrl: './trucks.component.scss'
})
export class TrucksComponent {


  private translate = inject(TranslateService);
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
    'created_by',
    'created_at'

  ];

  // Filtrelenebilen alanlar
  filterableColumns: string[] = [
    'name',
    'dimension.width',
    'dimension.height',
    'dimension.depth',
  ];

  columnTypes: { [key: string]: string } = {
    'created_at': 'date'
  };

  // İlişkili nesne sütunları için özel görüntüleme ayarları
  nestedDisplayColumns: { [key: string]: string } = {
    'name': this.translate.instant('TRUCK.VEHICLE_TYPE'),
    'dimension.width': this.translate.instant('DIMENSIONS.LENGTH'),
    'dimension.height': this.translate.instant('DIMENSIONS.HEIGHT'),
    'dimension.depth': this.translate.instant('DIMENSIONS.WIDTH'),
    'created_by': this.translate.instant('COMMON.USER'),
    'created_at': this.translate.instant('ORDER.CREATION_DATE'),
  };

  ngOnInit(): void {
  }
}
