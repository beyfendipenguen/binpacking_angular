import { Injectable } from '@angular/core';
import {
  WeightType,
  CalculationResult,
} from '../models/invoice-upload-interfaces';
import { OrderDetailRead } from '../../../../../../models/order-detail.interface';

@Injectable({
  providedIn: 'root',
})
export class InvoiceCalculatorService {
  calculateTotalWeight(
    orderDetails: OrderDetailRead[],
    weightType: WeightType
  ): CalculationResult {
    try {
      const totalWeight = orderDetails.reduce((sum, detail) => {
        const productWeight = detail.product?.weight_type?.[weightType] || 0;
        // Fix: Use 0 for undefined/null count instead of defaulting to 1
        const count = detail.count ?? 0;
        return sum + productWeight * count;
      }, 0);

      return { totalWeight };
    } catch (error) {

      return { totalWeight: 0 };
    }
  }

  calculateDetailWeight(detail: OrderDetailRead, weightType: WeightType): number {
    try {
      const productWeight = detail.product?.weight_type?.[weightType] || 0;
      // Fix: Use 0 for undefined/null count instead of defaulting to 1
      const count = detail.count ?? 0;
      return productWeight * count;
    } catch (error) {

      return 0;
    }
  }

  validateWeightType(weightType: string): weightType is WeightType {
    return ['std', 'pre', 'eco'].includes(weightType);
  }

  getAvailableWeightTypes(): WeightType[] {
    return ['std', 'pre', 'eco'];
  }

  formatWeight(weight: number, precision: number = 2): string {
    return weight.toFixed(precision);
  }

  calculateWeightPercentage(
    partialWeight: number,
    totalWeight: number
  ): number {
    if (totalWeight === 0) return 0;
    return (partialWeight / totalWeight) * 100;
  }
}
