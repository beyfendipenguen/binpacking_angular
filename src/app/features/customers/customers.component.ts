import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CompanyRelationService } from '../services/company-relation.service';
import { CompanyRelation, RELATION_TYPE_OPTIONS } from '../interfaces/company-relation.interface';
import { ConfirmDialogComponent } from '@app/shared/generic-table/confirm-dialog/confirm-dialog.component';
import { ToastService } from '@app/core/services/toast.service';
import { CustomerDialogComponent } from './dialogs/customer-dialog/customer-dialog.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent implements OnInit {
  private companyRelationService = inject(CompanyRelationService);
  private dialog = inject(MatDialog);
  private toastService = inject(ToastService);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Data source
  dataSource = new MatTableDataSource<CompanyRelation>([]);

  // Table columns
  displayedColumns: string[] = [
    'target_company_name',
    'target_company_country',
    'relation_type_display',
    'is_active',
    'notes',
    'actions'
  ];

  // State
  isLoading = false;
  totalItems = 0;
  pageSize = 10;
  currentPage = 0;
  searchTerm = '';
  currentSortField = '';
  currentSortDirection = '';

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Sort listener
    if (this.sort) {
      this.sort.sortChange.subscribe((sort: Sort) => {
        this.currentPage = 0;
        if (this.paginator) {
          this.paginator.pageIndex = 0;
        }
        this.currentSortField = sort.active;
        this.currentSortDirection = sort.direction;
        this.loadData();
      });
    }
  }


  /**
   * İlişki türünü Türkçe label'a çevir
   */
  getRelationTypeLabel(relationType: string): string {
    const option = RELATION_TYPE_OPTIONS.find(opt => opt.value === relationType);
    return option ? option.label : relationType;
  }

  /**
   * Load data from API
   */
  loadData(): void {
    this.isLoading = true;

    const params: any = {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };

    // Sorting
    if (this.currentSortField && this.currentSortDirection) {
      params.ordering = `${this.currentSortDirection === 'desc' ? '-' : ''}${this.currentSortField}`;
    }

    // Search
    if (this.searchTerm && this.searchTerm.trim()) {
      params.search = this.searchTerm.trim();
    }

    this.companyRelationService.getAll(params).subscribe({
      next: (page) => {
        this.dataSource.data = page.results;
        this.totalItems = page.count;
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error('Veriler yüklenirken hata oluştu', 'Hata');
        this.isLoading = false;
        this.dataSource.data = [];
        this.totalItems = 0;
      }
    });
  }

  /**
   * Handle page change
   */
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
  }

  /**
   * Handle search input
   */
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.currentPage = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.loadData();
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.loadData();
  }

  /**
   * Open dialog to add new customer
   */
  openAddDialog(): void {
    const dialogRef = this.dialog.open(CustomerDialogComponent, {
      width: '700px',
      data: { mode: 'create' },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData(); // Refresh table
      }
    });
  }

  /**
   * Open dialog to edit customer
   */
  openEditDialog(row: CompanyRelation): void {
    const dialogRef = this.dialog.open(CustomerDialogComponent, {
      width: '700px',
      data: { mode: 'edit', relation: row },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData(); // Refresh table
      }
    });
  }

  /**
   * Open row detail dialog
   */
  onRowClick(row: CompanyRelation): void {
    this.openEditDialog(row);
  }

  /**
   * Delete customer with confirmation
   */
  deleteCustomer(row: CompanyRelation, event: Event): void {
    event.stopPropagation(); // Prevent row click

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: `"${row.target_company.company_name}" müşterisini silmek istediğinizden emin misiniz?`
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed && row.id) {
        this.isLoading = true;
        this.companyRelationService.delete(row.id).subscribe({
          next: () => {
            this.toastService.success('Müşteri başarıyla silindi', 'Başarılı');
            this.loadData();
          },
          error: (error) => {
            this.toastService.error('Müşteri silinirken hata oluştu', 'Hata');
            this.isLoading = false;
          }
        });
      }
    });
  }

  /**
   * Get column display name
   */
  getColumnName(column: string): string {
    const names: { [key: string]: string } = {
      'target_company_name': 'Müşteri Adı',
      'target_company_country': 'Ülke',
      'relation_type_display': 'İlişki Türü',
      'is_active': 'Durum',
      'notes': 'Notlar',
      'actions': 'İşlemler'
    };
    return names[column] || column;
  }
}
