import { Injectable, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FileUploadManager } from './file-upload.manager';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '@app/features/interfaces/order.interface';

@Injectable({
  providedIn: 'root'
})
export class OrderFormManager {
  private readonly formBuilder = inject(FormBuilder);
  private readonly fileUploadManager = inject(FileUploadManager);

  private uploadForm!: FormGroup;
  private order: Order | null = null;

  initializeForm(): FormGroup {
    this.uploadForm = this.formBuilder.group({
      fileInput: ['', [Validators.required, this.fileUploadManager.fileValidator]],
      orderName: ['', Validators.required],
      orderDate: ['', Validators.required],
      companyRelation: ['', Validators.required],
      truck: ['', Validators.required],
      weightType: ['', Validators.required],
    });

    return this.uploadForm;
  }



  resetForm(): void {
    if (this.uploadForm) {
      this.uploadForm.reset();
    }
  }

  initializeNewOrder(): Order {
    this.order = {
      id: uuidv4(),
      name: '',
      date: null,
      company_relation: null,
      truck: null,
      weight_type: '',
    } as unknown as Order;

    return this.order;
  }


  updateOrderField(field: string, value: any): Order {
    if (!this.order) {
      this.order = this.initializeNewOrder();
    }

    // immutable güncelleme
    this.order = {
      ...this.order,
      [field]: value
    };

    return this.order;
  }

  updateCompanyRelation(selectedCompany: any): Order {
    if (!this.order) {
      this.order = this.initializeNewOrder();
    }

    // immutable güncelleme
    this.order = {
      ...this.order,
      company_relation: selectedCompany
    };

    return this.order;
  }

  updateTruck(selectedTruck: any): Order {
    if (!this.order) {
      this.order = this.initializeNewOrder();
    }

    this.order = {
      ...this.order,
      truck: selectedTruck
    };

    return this.order;
  }

  updateWeightType(selectedWeightType: string): Order {
    if (!this.order) {
      this.order = this.initializeNewOrder();
    }

    this.order = {
      ...this.order,
      weight_type: selectedWeightType
    };

    return this.order;
  }

  getFormattedDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'N/A';
    }

    if (isNaN(dateObj.getTime())) {
      return 'N/A';
    }

    return `${dateObj.getDate().toString().padStart(2, '0')}.${(
      dateObj.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}.${dateObj.getFullYear()}`;
  }

  compareObjects(a: any, b: any): boolean {
    if (!a || !b) return false;
    return a.id === b.id;
  }

  compareCompanies(a: any, b: any): boolean {
    if (!a || !b) return false;
    return a.id === b.id || a.target_company_name === b.target_company_name;
  }

  compareWeightTypes(a: string, b: string): boolean {
    return a === b;
  }
}
