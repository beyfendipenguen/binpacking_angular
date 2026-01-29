import { Component, Inject, OnInit, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ColumnDefinition } from '@app/shared/generic-table/generic-table.component';
import { PackageService } from '@app/features/services/package.service';
import { PackageReadDto } from '@app/features/interfaces/package.interface';

interface GroupedPackage {
  id: string;
  palletName: string;
  dimension: string;
  itemCount: number;
  items: any[];
  expanded?: boolean;
}

@Component({
  selector: 'app-package-dialog',
  standalone: true,
  imports: [CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule
  ],
  templateUrl: './package-dialog.component.html',
  styleUrl: './package-dialog.component.scss'
})
export class PackageDialogComponent implements OnInit {

  private translate = inject(TranslateService);
  packageService = inject(PackageService);

  // Grouped packages for display
  groupedPackages: GroupedPackage[] = [];
  isLoading: boolean = false;

  // Table configuration for package items (when expanded)
  displayedColumns: string[] = [
    'product.name',
    'count'
  ];

  columnDefinitions: ColumnDefinition[] = [
    {
      key: 'product.name',
      label: this.translate.instant('DIMENSIONS.PRODUCT_NAME'),
      type: 'text',
      required: true
    },
    {
      key: 'count',
      label: this.translate.instant('DIMENSIONS.QUANTITY'),
      type: 'number',
      required: true
    }
  ];

  nestedDisplayColumns: { [key: string]: string } = {
    'product.name': this.translate.instant('DIMENSIONS.PRODUCT_NAME')
  };

  constructor(
    public dialogRef: MatDialogRef<PackageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      orderId: string;
      orderName: string;
      companyName: string;
    }
  ) { }

  ngOnInit(): void {
    this.loadPackageDetails();
  }

  /**
   * Load package details and group them
   */
  loadPackageDetails(): void {
    this.isLoading = true;

    const params = {
      order_id: this.data.orderId,
      limit: 400,
      offset: 0
    };

    this.packageService.getAll(params).subscribe({
      next: (response) => {
        this.groupPackageDetails(response.results);
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Group package details by package ID
   */
  groupPackageDetails(packages: PackageReadDto[]): void {
    if (!packages || !packages.length) {
      this.groupedPackages = [];
      return;
    }

    this.groupedPackages = packages.toSorted((a,b)=>a.name- b.name). map(pkg => {
      const dimension = pkg.pallet?.dimension;
      const dimensionStr = dimension
        ? `${dimension.width} × ${dimension.depth} ${dimension.unit || this.translate.instant('DIMENSIONS.MM')}`
        : 'N/A';

      return {
        id: pkg.id,
        palletName: pkg.name || this.translate.instant('PALLET_CONTROL.PALLET'),
        dimension: dimensionStr,
        itemCount: pkg.package_details?.length || 0,
        items: pkg.package_details || [],
        expanded: false
      };
    });
  }

  /**
   * Toggle package expansion
   */
  togglePackage(pkg: GroupedPackage): void {
    pkg.expanded = !pkg.expanded;
  }

  /**
   * Close dialog
   */
  close(): void {
    this.dialogRef.close();
  }
}
