import { Injectable } from '@angular/core';
import { OrderDetailRead } from '@app/features/interfaces/order-detail.interface';
import { WeightCategory } from '@app/features/interfaces/weight-category.interface';
import { CalculationResult } from '../models/invoice-upload-interfaces';

@Injectable({
  providedIn: 'root',
})
export class InvoiceCalculatorService {

  calculateTotalWeight(
    orderDetails: OrderDetailRead[],
    weightCategory: WeightCategory | null
  ): CalculationResult {
    try {
      if (!weightCategory) return { totalWeight: 0 };
      const key = weightCategory.key;

      const totalWeight = orderDetails.reduce((sum, detail) => {
        const productWeight = detail.product?.weights?.find(
          w => w.category.key === key
        )?.value || 0;
        const count = detail.count ?? 0;
        return sum + Number(productWeight) * count;
      }, 0);

      return { totalWeight };
    } catch (error) {
      return { totalWeight: 0 };
    }
  }

  calculateDetailWeight(
    detail: OrderDetailRead,
    weightCategory: WeightCategory | null
  ): number {
    try {
      if (!weightCategory) return 0;
      const productWeight = detail.product?.weights?.find(
        w => w.category.key === weightCategory.key
      )?.value || 0;
      const count = detail.count ?? 0;
      return Number(productWeight) * count;
    } catch (error) {
      return 0;
    }
  }

  formatWeight(weight: number, precision: number = 2): string {
    return weight.toFixed(precision);
  }

  calculateWeightPercentage(partialWeight: number, totalWeight: number): number {
    if (totalWeight === 0) return 0;
    return (partialWeight / totalWeight) * 100;
  }
}
