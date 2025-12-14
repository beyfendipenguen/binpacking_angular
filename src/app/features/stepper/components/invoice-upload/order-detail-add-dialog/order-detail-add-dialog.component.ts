import { Component, inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  switchMap,
} from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Product } from '@features/interfaces/product.interface';
import { ProductService } from '@features/services/product.service';
import { AppState, selectOrder } from '@app/store';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { generateUUID } from 'three/src/math/MathUtils.js';

@Component({
  selector: 'app-order-detail-add-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatIconModule,
  ],
  templateUrl: './order-detail-add-dialog.component.html',
  styleUrl: './order-detail-add-dialog.component.scss',
})
export class OrderDetailAddDialogComponent implements OnInit {
  
  private translate = inject(TranslateService);
orderDetailForm: FormGroup;
  dimensionSearchForm: FormGroup;
  prod!: Product;

  filteredProducts: any[] = [];
  isLoading = false;
  hasError = false;
  errorMessage = '';
  activeTab = 0;

  private store = inject(Store<AppState>);
  public orderSignal = this.store.selectSignal(selectOrder);

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<OrderDetailAddDialogComponent>,
    private productService: ProductService
  ) {
    // Main order form
    this.orderDetailForm = this.fb.group({
      id: generateUUID(),
      order: [this.orderSignal(), Validators.required], // Use data directly as the Order object
      product: [this.prod, Validators.required],
      count: [1, [Validators.required, Validators.min(1)]],
      unit_price: [0, [Validators.required, Validators.min(0.01)]],
    });

    // Dimension search form
    this.dimensionSearchForm = this.fb.group({
      width: [null, [Validators.min(0)]],
      height: [null, [Validators.min(0)]],
      depth: [null, [Validators.min(0)]],
    });
  }

  ngOnInit(): void {
    this.orderDetailForm
      .get('product')
      ?.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value === 'string' && value.trim().length > 2) {
            this.isLoading = true;
            this.hasError = false;

            // Artık searchProductsWithParsedQuery kullan
            return this.productService
              .searchProductsWithParsedQuery(value, 10)
              .pipe(
                catchError((error) => {
                  this.hasError = true;
                  this.errorMessage = this.translate.instant('INVOICE_UPLOAD.SEARCH_ERROR');
                  return of([]);
                }),
                finalize(() => {
                  this.isLoading = false;
                })
              );
          }
          return of([]);
        })
      )
      .subscribe({
        next: (products: any[]) => {
          this.filteredProducts = products;
        },
      });
  }

  displayProductFn(product: any): string {
    return product ? product.name : '';
  }

  selectProduct(product: Product): void {
    // Update form value when product is selected
    this.orderDetailForm.patchValue({
      product: product,
      unit_price: 1.0, // Default value or value from product
    });
  }

  onTabChange(event: any): void {
    this.activeTab = event.index;
    // Clear results when tab changes
    this.filteredProducts = [];
    this.hasError = false;
  }

  onSubmit(): void {
    if (this.orderDetailForm.valid) {
      const requestData = {
        apiRequestItem: {
          count: this.orderDetailForm.value['count'],
          unit_price: this.orderDetailForm.value['unit_price'],
          product_id: this.orderDetailForm.value['product'],
          order_id: this.orderDetailForm.value['order'],
        },
        orderDetail: this.orderDetailForm.value,
      };
      this.dialogRef.close(requestData);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
