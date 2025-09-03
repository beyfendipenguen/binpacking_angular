import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {  MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';
import {  of } from 'rxjs';
import { ProductService } from '../../../../../services/product.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Product } from '../../../../../../../models/product.interface';
import * as StepperSelectors from '../../../../../../../store/stepper/stepper.selectors';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../../../../store';
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
    MatIconModule
  ],
  templateUrl: './order-detail-add-dialog.component.html',
  styleUrl: './order-detail-add-dialog.component.scss'
})
export class OrderDetailAddDialogComponent implements OnInit {
  orderDetailForm: FormGroup;
  dimensionSearchForm: FormGroup;
  prod!: Product;

  filteredProducts: any[] = [];
  isLoading = false;
  hasError = false;
  errorMessage = '';
  activeTab = 0;

  private store = inject(Store<AppState>)
  public orderSignal = this.store.selectSignal(StepperSelectors.selectOrder)

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
      unit_price: [0, [Validators.required, Validators.min(0.01)]]
    });

    // Dimension search form
    this.dimensionSearchForm = this.fb.group({
      width: [null, [Validators.min(0)]],
      height: [null, [Validators.min(0)]],
      depth: [null, [Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    // Text search
    this.orderDetailForm.get('product')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(value => {
          if (typeof value === 'string' && value.length > 2) {
            this.isLoading = true;
            this.hasError = false;
            // Get maximum 10 results
            return this.productService.searchProducts(value, 10).pipe(
              catchError(error => {
                this.hasError = true;
                this.errorMessage = 'Ürün arama sırasında bir hata oluştu.';

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
        }
      });


  }

  // Search using dimension filter form
  searchByDimensions(): void {
    this.isLoading = true;
    this.hasError = false;

    const width = this.dimensionSearchForm.get('width')?.value;
    const height = this.dimensionSearchForm.get('height')?.value;
    const depth = this.dimensionSearchForm.get('depth')?.value;

    // At least one dimension must be entered
    if (!width && !height && !depth) {
      this.hasError = true;
      this.errorMessage = 'En az bir boyut değeri girilmelidir.';
      this.isLoading = false;
      return;
    }

    this.productService.searchByDimensions(width, height, depth, 10)
      .pipe(
        catchError(error => {
          this.hasError = true;
          this.errorMessage = 'Boyutlara göre arama sırasında bir hata oluştu.';

          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(products => {
        this.filteredProducts = products;
      });
  }

  displayProductFn(product: any): string {
    return product ? product.name : '';
  }

  selectProduct(product: Product): void {
    // Update form value when product is selected
    this.orderDetailForm.patchValue({
      product: product,
      unit_price: 1.00 // Default value or value from product
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
        apiRequestItem:{"count": this.orderDetailForm.value['count'],
        "unit_price": this.orderDetailForm.value['unit_price'],
        "product_id": this.orderDetailForm.value['product'],
        "order_id": this.orderDetailForm.value['order'],},
        orderDetail : this.orderDetailForm.value
      }
      console.log(requestData.orderDetail)
      this.dialogRef.close(requestData);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
