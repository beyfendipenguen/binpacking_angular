import { CompanyRelation } from "@app/features/interfaces/company-relation.interface";
import { OrderDetailRead, OrderDetailWrite } from "@app/features/interfaces/order-detail.interface";
import { Order } from "@app/features/interfaces/order.interface";
import { Truck } from "@app/features/interfaces/truck.interface";

export interface InvoiceUploadState {
  order: Order | null;
  orderDetails: OrderDetailRead[];
  hasFile: boolean;
  fileName?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FormData {
  fileInput: string;
  orderName: string;
  orderDate: string;
  companyRelation: any;
  truck: any;
  weightType: string;
}


export interface OrderDetailUpdateEvent {
  item: OrderDetailRead;
  data: any;
}

export interface OrderDetailChanges {
  added: OrderDetailWrite[];
  modified: OrderDetailWrite[];
  deletedIds: string[];
}

export interface ReferenceData {
  targetCompanies: CompanyRelation[];
  trucks: Truck[];
}

export interface UIState {
  isLoading: boolean;
  excelUpload: boolean;
  dataRefreshInProgress: boolean;
}

export interface FileState {
  file: File | null;
  tempFile: File | null;
}

export interface CalculationResult {
  totalWeight: number;
}

export type WeightType = 'std' | 'pre' | 'eco';

export type AutoSaveChangeType = 'form' | 'user-action' | 'api-response';

export interface AutoSaveData {
  order: Order;
  orderDetails: OrderDetailRead[];
  hasFile: boolean;
  fileName?: string;
}
