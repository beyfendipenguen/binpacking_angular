import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AppState, selectIsPackagesDirty, selectOrderDetails, selectRemainingProducts, selectVerticalSort } from '@app/store';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-calculate-params-dialog',
  imports: [CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatCheckboxModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    TranslateModule, MatIconModule],
  templateUrl: './calculate-params-dialog.component.html',
  styleUrl: './calculate-params-dialog.component.scss'
})
export class CalculateParamsDialogComponent {
  private store = inject(Store<AppState>);
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<CalculateParamsDialogComponent>);

  orderDetailsSignal = this.store.selectSignal(selectOrderDetails);
  verticalSortSignal = this.store.selectSignal(selectVerticalSort);
  remainingProductsSignal = this.store.selectSignal(selectRemainingProducts);
  isDirtySignal = this.store.selectSignal(selectIsPackagesDirty);

  form: FormGroup = this.fb.group({
    verticalSort: [this.verticalSortSignal()],
    onlyRemaining: false,
    params: this.fb.group({})
  });

  ngOnInit() {
    // Her orderDetail için form control oluştur
    const paramsGroup = this.form.get('params') as FormGroup;
    this.orderDetailsSignal().forEach(detail => {
      paramsGroup.addControl(detail.id, this.fb.control(null));
    });
    this.form.get('onlyRemaining')?.valueChanges.subscribe(onlyRemaining => {
    const paramsGroup = this.form.get('params') as FormGroup;

    if (onlyRemaining) {
      // Disable all inputs
      Object.keys(paramsGroup.controls).forEach(key => {
        paramsGroup.get(key)?.setValue(null);
        paramsGroup.get(key)?.disable();
      });
    } else {
      // Enable all inputs
      Object.keys(paramsGroup.controls).forEach(key => {
        paramsGroup.get(key)?.enable();
      });
    }
  });
  }

  onCalculate() {
  const formValue = this.form.value;
  const onlyRemaining = formValue.onlyRemaining;

  const orderDetailParams = onlyRemaining
    ? []
    : Object.entries<number | null>(formValue.params)
        .filter((entry): entry is [string, number] => {
          const count = entry[1];
          return count !== null && count !== undefined && count > 0;
        })
        .map(([orderDetailId, count]) => ({
          orderDetailId,
          count
        }));

  this.dialogRef.close({
    orderDetailParams: formValue.onlyRemaining ? [] : orderDetailParams,
    verticalSort: formValue.verticalSort,
    onlyRemaining: formValue.onlyRemaining,  // ← Direkt aktarılıyor
    remainingProducts: formValue.onlyRemaining ? this.remainingProductsSignal() : undefined
  });
}

  onCancel() {
    this.dialogRef.close();
  }
}
