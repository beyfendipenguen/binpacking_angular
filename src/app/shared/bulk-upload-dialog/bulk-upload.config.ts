import { BulkUploadResponse } from '@app/features/interfaces/product.interface';
import { Observable } from 'rxjs';

export interface BulkUploadConfig {
  entityName: string;
  entityNamePlural: string;
  icon: string;
  templateType: string;
  templateFileName: string;
  uploadFn: (file: File) => Observable<BulkUploadResponse>;
  uploadUrl: string;   // YENİ
  instructions?: string[];
  acceptedFileTypes?: string[];
  showTemplateDownload?: boolean;
}

// YENİ tipler
export interface BulkUploadJobResponse {
  task_id: string;
}

export interface BulkUploadStatusResponse {
  state: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE';
  result?: BulkUploadResponse;
  error?: string;
}

export interface BulkUploadError {
  row: number;
  message: string;
}

export interface BulkUploadSuccess {
  row: number;
  message: string;
}
