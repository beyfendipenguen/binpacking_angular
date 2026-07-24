import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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

interface ParsedOrderName {
  prefix: string;
  number: number;
  rev: string;
}

@Component({
  selector: 'app-change-order-number-dialog',
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
  ],
  templateUrl: './change-order-number-dialog.component.html',
  styleUrl: './change-order-number-dialog.component.scss',
})
export class ChangeOrderNumberDialogComponent implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly toastService = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<ChangeOrderNumberDialogComponent>);
  private readonly destroy$ = new Subject<void>();

  orderSearchControl = new FormControl<string | Order>('');
  newNumberControl = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(1),
  ]);
  confirmControl = new FormControl<boolean>(false);

  filteredOrders: Order[] = [];
  selectedOrder: Order | null = null;
  parsedName: ParsedOrderName | null = null;
  swapConflictOrder: Order | null = null;
  isSaving = false;

  ngOnInit(): void {
    this.orderSearchControl.valueChanges
      .pipe(startWith(''), debounceTime(300), takeUntil(this.destroy$))
      .subscribe(value => {
        if (typeof value === 'string') {
          this.searchOrders(value);
        }
      });

    // Yeni numara yazılırken hedef isimde başka sipariş var mı kontrol et —
    // varsa kullanıcıya "numaralar takas edilecek" uyarısı gösterilir.
    this.newNumberControl.valueChanges
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.checkSwapConflict());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private searchOrders(term: string): void {
    this.orderService.getAll({ search: term || '' }).subscribe({
      next: (response: any) => {
        this.filteredOrders = response.results || [];
      },
      error: () => {
        this.filteredOrders = [];
      },
    });
  }

  displayOrderName = (order: Order | string | null): string => {
    if (!order) return '';
    return typeof order === 'string' ? order : order.name || '';
  };

  onOrderSelected(order: Order): void {
    this.selectedOrder = order;
    this.parsedName = this.parseName(order.name);
    this.newNumberControl.setValue(this.parsedName?.number ?? null);
    this.confirmControl.setValue(false);
    this.swapConflictOrder = null;
  }

  /**
   * Hedef isimde (previewName) aynı müşteriye ait başka sipariş var mı?
   * Varsa swapConflictOrder set edilir; kaydetme swap moduna geçer.
   */
  private checkSwapConflict(): void {
    this.swapConflictOrder = null;
    const target = this.previewName;
    if (!target || !this.selectedOrder || target === this.selectedOrder.name) {
      return;
    }

    const selectedTargetId = this.selectedOrder.company_relation?.target_company?.id;

    this.orderService.getAll({ name: target }).subscribe({
      next: (response: any) => {
        // Backend filtresi icontains — birebir eşleşmeyi burada süz.
        // Asıl otoriter kontrol backend'de; bu sadece ön uyarı içindir.
        const exact = (response.results || []).find((o: Order) =>
          o.name === target &&
          o.id !== this.selectedOrder!.id &&
          o.company_relation?.target_company?.id === selectedTargetId
        );
        this.swapConflictOrder = exact || null;
      },
      error: () => {
        this.swapConflictOrder = null;
      },
    });
  }

  get isSwap(): boolean {
    return !!this.swapConflictOrder;
  }

  /** 'DEMO.2.Rev0' → {prefix, number, rev}; bozuk formatta null. */
  private parseName(name: string | undefined | null): ParsedOrderName | null {
    const parts = (name || '').split('.');
    if (parts.length !== 3) return null;
    const number = parseInt(parts[1], 10);
    if (isNaN(number)) return null;
    return { prefix: parts[0], number, rev: parts[2] };
  }

  get previewName(): string {
    if (!this.parsedName || !this.newNumberControl.value) return '';
    return `${this.parsedName.prefix}.${this.newNumberControl.value}.${this.parsedName.rev}`;
  }

  get canSave(): boolean {
    return !!(
      this.selectedOrder &&
      this.parsedName &&
      this.newNumberControl.valid &&
      this.newNumberControl.value !== this.parsedName.number &&
      this.confirmControl.value &&
      !this.isSaving
    );
  }

  save(): void {
    if (!this.canSave || !this.selectedOrder) return;

    this.isSaving = true;
    this.orderService
      .changeOrderNumber(
        this.selectedOrder.id,
        this.newNumberControl.value!,
        this.isSwap
      )
      .subscribe({
        next: (response) => {
          this.toastService.success(
            response.message ||
            this.translate.instant('ORDER.CHANGE_NUMBER_SUCCESS')
          );
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.isSaving = false;
          this.toastService.error(
            getApiErrorMessage(
              error,
              this.translate.instant('ORDER.CHANGE_NUMBER_ERROR')
            )
          );
        },
      });
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
