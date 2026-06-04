import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GenericTableComponent } from '@app/shared/generic-table/generic-table.component';
import { TruckService } from '../services/truck.service';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { ColumnDefinition } from '@app/shared/generic-table/interfaces/column-definition.interface';
import { ConfirmDialogComponent } from '@app/shared/generic-table/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

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
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);

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

  ngOnInit(): void { }

  onBeforeUpdate(event: { row: any; result: any; proceed: () => void; cancel: () => void }): void {
    this.truckService.checkUsage(event.row.id).subscribe({
      next: (usage) => {
        if (usage.in_use) {
          const orderNames = usage.orders.map((o: any) => o.name).join(', ');
          const count = usage.orders.length
          const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '450px',
            data: {
              message: this.translate.instant('GENERIC_TABLE.UPDATE_IN_USE_WARNING', { count: count, model: this.translate.instant('INVOICE_UPLOAD.TRUCK'), orders: orderNames }),
            }
          });
          dialogRef.afterClosed().subscribe(confirmed => {
            confirmed ? event.proceed() : event.cancel();
          });
        } else {
          event.proceed();
        }
      },
      error: () => event.proceed()
    });
  }

  onBeforeDelete(event: { id: any; proceed: () => void; cancel: () => void }): void {
    this.truckService.checkUsage(event.id).subscribe({
      next: (usage) => {
        if (usage.in_use) {
          const orderNames = usage.orders.map((o: any) => o.name).join(', ');
          const count = usage.orders.length
          this.dialog.open(ConfirmDialogComponent, {
            width: '450px',
            data: {
              message: this.translate.instant('GENERIC_TABLE.IN_USE_ERROR', { count: count, model: this.translate.instant('INVOICE_UPLOAD.TRUCK'), orders: orderNames }),
              hideConfirm: true,
            }
          });
          event.cancel();
        } else {
          event.proceed();
        }
      },
      error: () => event.proceed()
    });
  }
}
