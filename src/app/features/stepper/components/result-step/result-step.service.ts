import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AppState, selectActiveShipmentIndex, selectIsMultiShipment, selectOrderId, selectOrderResult, selectPackages, selectShipments, selectStep3IsDirty, StepperResultActions } from '@app/store';
import { ToastService } from '@core/services/toast.service';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { PackageData, PackagePosition } from '@app/features/interfaces/order-result.interface';

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
  type: string | null;
  file_size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResultStepService {

  private translate = inject(TranslateService);
  private readonly store = inject(Store<AppState>);
  private readonly repositoryService = inject(RepositoryService);
  private readonly toastService = inject(ToastService);
  private readonly orderIdSignal = this.store.selectSignal(selectOrderId)
  /**
   * Calculate binpacking and generate report
   */
  calculateAndGenerateReport(multiShipment: boolean = false): Observable<{
    orderResultId: string;
    orderResult: PackagePosition[];
    reportFiles: ReportFile[];
    shipments?: PackagePosition[][];
    isMultiShipment: boolean;
  }> {
    return this.repositoryService.calculatePacking(multiShipment).pipe(
      switchMap(packingResponse => {
        const orderResultId = packingResponse.order_result.id;
        const raw = packingResponse.order_result.result;

        // Multi shipment ise shipments array gelir
        const shipments: PackagePosition[][] = raw.shipments.map((s: any) => s.result);
        const isMultiShipment = shipments.length > 1;
        const orderResult: PackagePosition[] = shipments[0] ?? [];

        return this.repositoryService.createReport(this.orderIdSignal()).pipe(
          map(reportResponse => ({
            orderResultId,
            orderResult,
            shipments,
            isMultiShipment,
            reportFiles: Array.isArray(reportResponse?.files)
              ? reportResponse.files.map((file: any) => ({
                id: file.id,
                name: file.name,
                type: file.type || file.file_type,
                file: file.file
              }))
              : []
          }))
        );
      })
    );
  }


  /**
   * Convert pieces data to JSON string for submission
   */
  async formatAllShipmentsForResult(): Promise<{ shipments: { shipment: number; result: PackagePosition[] }[] }> {
    const packages = await firstValueFrom(this.store.select(selectPackages));
    const shipments = await firstValueFrom(this.store.select(selectShipments));
    const isMultiShipment = await firstValueFrom(this.store.select(selectIsMultiShipment));
    const currentOrderResult = await firstValueFrom(this.store.select(selectOrderResult));
    const activeIndex = await firstValueFrom(this.store.select(selectActiveShipmentIndex));

    const mapToName = (row: PackagePosition): PackagePosition => {
      const matchingPackage = packages.find((pkg: any) => pkg.id === row[8]);
      const pieceId = matchingPackage ? matchingPackage.name : row[6];
      return [row[0], row[1], row[2], row[3], row[4], row[5], pieceId, row[7], row[8]] as PackagePosition;
    };

    if (!isMultiShipment || shipments.length === 0) {
      // Tek shipment — mevcut orderResult'u kullan
      const formatted = currentOrderResult.map(mapToName);
      return { shipments: [{ shipment: 1, result: formatted }] };
    }

    // Çoklu shipment — store'daki tüm shipments array'ini kullan
    // (aktif olanı en güncel orderResult ile değiştir, çünkü orderResult zaten
    //  her değişiklikte shipments[activeIndex]'e yazılıyordu, ama garantiye alalım)
    const finalShipments = shipments.map((s, i) => i === activeIndex ? currentOrderResult : s);

    return {
      shipments: finalShipments.map((result, i) => ({
        shipment: i + 1,
        result: result.map(mapToName)
      }))
    };
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
      this.toastService.warning(this.translate.instant('RESULT_STEP.FILE_NOT_FOUND'));
      return;
    }

    try {
      window.open(file.file, '_blank');
      this.toastService.success(this.translate.instant('FILE.FILE_OPENING'));
    } catch (error) {
      this.toastService.error(this.translate.instant('FILE.FILE_OPEN_ERROR'));
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
      type.includes('xls') ||
      type.includes('order_template_report')
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
