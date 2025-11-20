import { CompanyRelation } from "../../../../../../models/company-relation.interface";
import { Document } from "../../../../../../models/file.interface";
import { OrderDetailRead, OrderDetailWrite } from "../../../../../../models/order-detail.interface";
import { Order } from "../../../../../../models/order.interface";
import { Truck } from "../../../../../../models/truck.interface";


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
