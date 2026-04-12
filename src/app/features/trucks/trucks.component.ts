import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GenericTableComponent } from '@app/shared/generic-table/generic-table.component';
import { TruckService } from '../services/truck.service';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { ColumnDefinition } from '@app/shared/generic-table/interfaces/column-definition.interface';

@Component({
  selector: 'app-trucks',
  imports: [
    CommonModule,
    GenericTableComponent,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    HasPermissionDirective
  ],
  templateUrl: './trucks.component.html',
  styleUrl: './trucks.component.scss'
})
export class TrucksComponent implements OnInit {
  truckService = inject(TruckService);
  isLoading = false;

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'name',
      label: 'TRUCK.VEHICLE_TYPE',
      type: 'text',
      required: true,
      maxLength: 255
    },
    {
      key: 'dimension.width',
      label: 'DIMENSIONS.LENGTH',
      type: 'number',
      required: true,
      min: 0,
      hint: 'mm'
    },
    {
      key: 'dimension.depth',
      label: 'DIMENSIONS.WIDTH',
      type: 'number',
      required: true,
      min: 0,
      hint: 'mm'
    },
    {
      key: 'dimension.height',
      label: 'DIMENSIONS.HEIGHT',
      type: 'number',
      required: true,
      min: 0,
      hint: 'mm'
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
    .filter(c => c.type === 'number' || c.key === 'name')
    .map(c => c.key);

  columnTypes: { [key: string]: string } = {
    'created_at': 'date'
  };

  ngOnInit(): void {}
}
