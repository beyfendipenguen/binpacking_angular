import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, startWith, takeUntil } from 'rxjs';

import { ToastService } from '@core/services/toast.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { Order } from '@features/interfaces/order.interface';
import { OrderService } from '@features/services/order.service';
import { CompanyRelation, RelationType } from '@features/interfaces/company-relation.interface';
import { CompanyRelationService } from '@features/services/company-relation.service';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-merge-orders-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    MatTooltipModule
  ],
  templateUrl: './merge-orders-dialog.component.html',
  styleUrl: './merge-orders-dialog.component.scss',
})
export class MergeOrdersDialogComponent implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly companyRelationService = inject(CompanyRelationService);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<MergeOrdersDialogComponent>);
  private readonly destroy$ = new Subject<void>();

  orderSearchControl = new FormControl<string>('');
  customerSearchControl = new FormControl<string | CompanyRelation>('');
  confirmControl = new FormControl<boolean>(false);

  searchResults: Order[] = [];
  selectedOrders: Order[] = [];
  filteredRelations: CompanyRelation[] = [];
  selectedRelation: CompanyRelation | null = null;
  isSaving = false;

  ngOnInit(): void {
    // Arama boşken de ilk 5 sipariş gösterilir (startWith('')).
    this.orderSearchControl.valueChanges
      .pipe(startWith(''), debounceTime(300), takeUntil(this.destroy$))
      .subscribe(value => this.searchOrders(value || ''));

    this.customerSearchControl.valueChanges
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(value => {
        if (typeof value === 'string') {
          this.searchRelations(value);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private searchOrders(term: string): void {
    this.orderService.getAll({ search: term, limit: 5 }).subscribe({
      next: (response: any) => {
        const results: Order[] = response.results || [];
        // Zaten seçilmiş olanları sonuç listesinden çıkar
        this.searchResults = results.filter(
          o => !this.selectedOrders.some(s => s.id === o.id)
        );
      },
      error: () => {
        this.searchResults = [];
      },
    });
  }

  private searchRelations(term: string): void {
    if (!term) {
      this.filteredRelations = [];
      return;
    }
    this.companyRelationService
      .getAll({ search: term, relation_type: RelationType.CUSTOMER, limit: 5 })
      .subscribe({
        next: (response: any) => {
          this.filteredRelations = response.results || [];
        },
        error: () => {
          this.filteredRelations = [];
        },
      });
  }

  displayRelationName = (relation: CompanyRelation | string | null): string => {
    if (!relation) return '';
    return typeof relation === 'string' ? relation : relation.target_company?.company_name || '';
  };

  onRelationSelected(relation: CompanyRelation): void {
    this.selectedRelation = relation;
    this.confirmControl.setValue(false);
  }

  addOrder(order: Order): void {
    if (this.selectedOrders.some(o => o.id === order.id)) return;
    this.selectedOrders = [...this.selectedOrders, order];
    this.searchResults = this.searchResults.filter(o => o.id !== order.id);
    this.confirmControl.setValue(false);
  }

  removeOrder(order: Order): void {
    this.selectedOrders = this.selectedOrders.filter(o => o.id !== order.id);
    this.confirmControl.setValue(false);
    // Kaldırılan sipariş, güncel arama sonuçlarına tekrar uygun olabilir —
    // basitçe mevcut arama terimiyle listeyi tazele.
    this.searchOrders(this.orderSearchControl.value || '');
  }

  get canSave(): boolean {
    return (
      this.selectedOrders.length >= 2 &&
      !!this.selectedRelation &&
      !!this.confirmControl.value &&
      !this.isSaving
    );
  }

  save(): void {
    if (!this.canSave || !this.selectedRelation) return;

    this.isSaving = true;
    const orderIds = this.selectedOrders.map(o => o.id);
    this.orderService.mergeOrders(orderIds, this.selectedRelation.id).subscribe({
      next: (response) => {
        this.toastService.success(
          response.message || this.translate.instant('ORDER.MERGE_SUCCESS')
        );
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.isSaving = false;
        this.toastService.error(
          getApiErrorMessage(error, this.translate.instant('ORDER.MERGE_ERROR'))
        );
      },
    });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
