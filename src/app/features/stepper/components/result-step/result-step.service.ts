import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { AppState, selectOrderId, selectPackages, selectStep3IsDirty } from '@app/store';
import { StepperResultActions } from '@app/store/stepper/actions/stepper-result.actions';
import { ToastService } from '@core/services/toast.service';
import { RepositoryService } from '@features/stepper/services/repository.service';

/**
 * Result Step Service
 *
 * Result Step component'inin business logic'ini yönetir:
 * - Binpacking calculation
 * - Report generation
 * - Order result submission
 * - File download handling
 */

export interface CalculationResult {
  orderResultId: string;
  piecesData: any[];
  success: boolean;
}

export interface ReportFile {
  id?: string;
  name: string;
  file: string;
  file_type: string | null;
  file_size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResultStepService {
  private readonly store = inject(Store<AppState>);
  private readonly repositoryService = inject(RepositoryService);
  private readonly toastService = inject(ToastService);
  private readonly orderIdSignal = this.store.selectSignal(selectOrderId)
  /**
   * Calculate binpacking and generate report
   */
  calculateAndGenerateReport(): Observable<{
    orderResultId: string;
    piecesData: any[];
    reportFiles: ReportFile[];
  }> {

    return this.repositoryService.calculatePacking().pipe(
      switchMap(packingResponse => {
        const orderResultId = packingResponse.data.order_result_id;
        const piecesData = this.processPiecesData(packingResponse.data.data || packingResponse.data);

        return this.repositoryService.createReport(this.orderIdSignal()).pipe(
          map(reportResponse => ({
            orderResultId,
            piecesData,
            reportFiles: Array.isArray(reportResponse?.files) ? reportResponse.files : []
          }))
        );
      })
    );
  }

  /**
   * Process pieces data from backend response
   */
  private processPiecesData(rawData: any): any[] {
    try {
      let packingData = null;

      if (typeof rawData === 'string') {
        try {
          packingData = JSON.parse(rawData);
        } catch (parseError) {
          packingData = null;
        }
      } else if (rawData?.data) {
        packingData = rawData.data;
      } else {
        packingData = rawData;
      }

      if (packingData && Array.isArray(packingData) && packingData.length > 0) {
        return this.validateAndCleanPackingData(packingData);
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Validate and clean packing data
   */
  private validateAndCleanPackingData(rawData: any[]): any[] {
    return rawData.filter((piece, index) => {
      if (!Array.isArray(piece) || piece.length < 6) {
        return false;
      }

      const [x, y, z, length, width, height] = piece;
      if ([x, y, z, length, width, height].some(val => typeof val !== 'number' || isNaN(val))) {
        return false;
      }

      return true;
    });
  }

  /**
   * Convert pieces data to JSON string for submission
   */
  async convertPiecesToJsonString(processedPackages: any[]): Promise<string> {
    const packages = await firstValueFrom(this.store.select(selectPackages));

    const formattedData = processedPackages.map(piece => {
      const matchingPackage = packages.find((pkg: any) => pkg.id === piece.pkgId);
      const pieceId = matchingPackage ? matchingPackage.name : piece.id;

      return [
        piece.x,
        piece.y,
        piece.z,
        piece.length,
        piece.width,
        piece.height,
        pieceId,
        piece.weight,
        piece.pkgId
      ];
    });

    return JSON.stringify(formattedData);
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): Observable<boolean> {
    return this.store.select(selectStep3IsDirty).pipe(take(1));
  }


  /**
   * Open file in new tab
   */
  openFile(file: ReportFile): void {
    if (!file?.file) {
      this.toastService.warning('Dosya bulunamadı');
      return;
    }

    try {
      window.open(file.file, '_blank');
      this.toastService.success('Dosya açılıyor...');
    } catch (error) {
      this.toastService.error('Dosya açılırken hata oluştu');
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (!bytes || isNaN(bytes)) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Get file icon based on file type
   */
  getFileIcon(fileType: string | null): string {
    if (!fileType) return 'insert_drive_file';

    const type = fileType.toLowerCase();

    if (type.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (
      type.includes('image') ||
      type.includes('jpg') ||
      type.includes('jpeg') ||
      type.includes('png')
    ) {
      return 'image';
    } else if (
      type.includes('excel') ||
      type.includes('sheet') ||
      type.includes('xlsx') ||
      type.includes('xls')
    ) {
      return 'table_chart';
    } else if (type.includes('word') || type.includes('doc')) {
      return 'description';
    } else if (
      type.includes('zip') ||
      type.includes('rar') ||
      type.includes('archive')
    ) {
      return 'folder_zip';
    } else if (type.includes('text') || type.includes('txt')) {
      return 'article';
    } else if (type.includes('video')) {
      return 'videocam';
    } else if (type.includes('audio')) {
      return 'audiotrack';
    }

    return 'insert_drive_file';
  }
}
