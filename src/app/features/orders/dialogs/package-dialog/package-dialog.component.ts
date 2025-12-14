import { Component, Inject, OnInit, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PackageDetailService } from '@app/features/services/package-detail.service';
import { ColumnDefinition } from '@app/shared/generic-table/generic-table.component';

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
  packageDetailService = inject(PackageDetailService);

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

    this.packageDetailService.getAll(params).subscribe({
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
  groupPackageDetails(packageDetails: any[]): void {
    if (!packageDetails || !packageDetails.length) {
      this.groupedPackages = [];
      return;
    }

    // Group by package ID
    const packageMap = new Map<string, GroupedPackage>();

    packageDetails.forEach((detail: any) => {
      const packageId = detail.package?.id;
      if (!packageId) return;

      if (!packageMap.has(packageId)) {
        const dimension = detail.package?.pallet?.dimension;
        const dimensionStr = dimension
          ? `${dimension.width} × ${dimension.depth} ${dimension.unit || this.translate.instant('DIMENSIONS.MM')}`
          : 'N/A';

        packageMap.set(packageId, {
          id: packageId,
          palletName: detail.package?.pallet?.name || this.translate.instant('PALLET_CONTROL.PALLET'),
          dimension: dimensionStr,
          itemCount: 0,
          items: [],
          expanded: false
        });
      }

      const pkg = packageMap.get(packageId)!;
      pkg.items.push(detail);
      pkg.itemCount = pkg.items.length;
    });

    this.groupedPackages = Array.from(packageMap.values());
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
