import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AppState, selectDeletedPackages, selectOrderResultId, selectActiveShipmentIndex, selectIsMultiShipment, selectOrder, selectOrderId, selectOrderResult, selectPackages, selectShipments, selectStep3IsDirty, StepperResultActions } from '@app/store';
import { calculatePackageTotalWeight } from '@app/features/utils/package-weight.util';
import { ToastService } from '@core/services/toast.service';
import { RepositoryService } from '@features/stepper/services/repository.service';
import { OrderResultService } from '@app/features/services/order-result.service';
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
  private readonly orderResultService = inject(OrderResultService);
  private readonly toastService = inject(ToastService);
  private readonly orderIdSignal = this.store.selectSignal(selectOrderId)
  /**
   * Calculate binpacking and generate report — asenkron akış:
   * 1. POST calculate-bin-packing → 202, hesap Celery'de başlar
   * 2. Status endpoint'i poll edilir (ready=true olana kadar)
   * 3. OrderResult çekilir, rapor üretilir
   */
  calculateAndGenerateReport(multiShipment: boolean = false): Observable<{
    orderResultId: string;
    orderResult: PackagePosition[];
    reportFiles: ReportFile[];
    shipments?: PackagePosition[][];
    isMultiShipment: boolean;
  }> {
    const orderId = this.orderIdSignal();

    return this.repositoryService.calculatePacking(multiShipment, orderId).pipe(
      // Hesap bitene kadar bekle
      switchMap(() => this.repositoryService.pollCalculationStatus(orderId)),
      switchMap(status => {
        if (!status.success) {
          throw new Error(
            status.error || this.translate.instant('RESULT_STEP.CALCULATION_FAILED')
          );
        }
        // Hesap bitti — sonucu çek
        return this.orderResultService.getByOrderId(orderId);
      }),
      switchMap(results => {
        const orderResultRecord: any = results[0];
        if (!orderResultRecord) {
          throw new Error(this.translate.instant('RESULT_STEP.CALCULATION_FAILED'));
        }

        const orderResultId = orderResultRecord.id;
        const raw = orderResultRecord.result;

        // Multi shipment ise shipments array gelir
        const shipments: PackagePosition[][] = raw.shipments.map((s: any) => s.result);
        const isMultiShipment = shipments.length > 1;
        const orderResult: PackagePosition[] = shipments[0] ?? [];

        return this.repositoryService.createReport(orderId).pipe(
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

    const order = await firstValueFrom(this.store.select(selectOrder));

    // Ağırlık TEK kaynaktan (step2 paketleri: palet + ürünler) yeniden hesaplanır;
    // satırda saklı eski ağırlık (row[7]) paketler elle düzenlendikten sonra
    // bayatlayabilir ve tır/PDF toplamının pallet control'den farklı çıkmasına
    // yol açıyordu. Eşleşen paket yoksa satırdaki değer korunur.
    const mapToName = (row: PackagePosition): PackagePosition => {
      const matchingPackage = packages.find((pkg: any) => pkg.id === row[8]);
      const pieceId = matchingPackage ? matchingPackage.name : row[6];
      const weight = matchingPackage
        ? calculatePackageTotalWeight(matchingPackage, order)
        : row[7];
      return [row[0], row[1], row[2], row[3], row[4], row[5], pieceId, weight, row[8]] as PackagePosition;
    };

    // Aynı pkgId birden fazla satırda olamaz (kopya satır tır/PDF ağırlığını şişirir).
    // İlk görülen sıra korunur, son (en taze) satır kullanılır.
    const dedupe = (rows: PackagePosition[]): PackagePosition[] => {
      const byId = new Map<string, PackagePosition>();
      for (const row of rows) byId.set(row[8], row);
      return Array.from(byId.values());
    };

    if (!isMultiShipment || shipments.length === 0) {
      // Tek shipment — mevcut orderResult'u kullan
      const formatted = dedupe(currentOrderResult).map(mapToName);
      return { shipments: [{ shipment: 1, result: formatted }] };
    }

    // Çoklu shipment — store'daki tüm shipments array'ini kullan
    // (aktif olanı en güncel orderResult ile değiştir, çünkü orderResult zaten
    //  her değişiklikte shipments[activeIndex]'e yazılıyordu, ama garantiye alalım)
    const finalShipments = shipments.map((s, i) => i === activeIndex ? currentOrderResult : s);

    // Boşalmış (tüm paketleri silinmiş) sevkiyatları kayıttan tamamen çıkar,
    // kalanları 1'den başlayarak ARADA BOŞLUK BIRAKMADAN yeniden numaralandır.
    // Örn: 6 sevkiyattan 3.'sü boşaldıysa 1,2,4,5,6 değil 1,2,3,4,5 olarak
    // kaydedilir.
    const nonEmptyShipments = finalShipments.filter(result => result.length > 0);

    return {
      shipments: nonEmptyShipments.map((result, i) => ({
        shipment: i + 1,
        result: dedupe(result).map(mapToName)
      }))
    };
  }

  /**
   * Otomatik/çıkış kaydı için payload: formatAllShipmentsForResult + yerleşmeyen
   * (deletedPackages) paketler -1,-1,-1 satırı olarak ilk sevkiyata eklenir.
   * Siparişe dönüşte enableEditMode$ plate'i bu -1 satırlardan kurar.
   */
  async buildPersistPayload(): Promise<{ shipments: { shipment: number; result: PackagePosition[] }[] }> {
    const payload = await this.formatAllShipmentsForResult();
    const packages = await firstValueFrom(this.store.select(selectPackages));
    const order = await firstValueFrom(this.store.select(selectOrder));
    const deleted = await firstValueFrom(this.store.select(selectDeletedPackages));

    const placedIds = new Set(payload.shipments.flatMap(s => s.result.map(r => r[8])));
    const unplacedById = new Map<string, PackagePosition>();
    for (const row of deleted) {
      if (placedIds.has(row[8])) continue;
      const pkg = packages.find((p: any) => p.id === row[8]);
      unplacedById.set(row[8], [
        -1, -1, -1, row[3], row[4], row[5],
        pkg ? pkg.name : row[6],
        pkg ? calculatePackageTotalWeight(pkg, order) : row[7],
        row[8]
      ] as PackagePosition);
    }
    const unplaced = Array.from(unplacedById.values());

    if (unplaced.length === 0) return payload;
    if (payload.shipments.length === 0) {
      return { shipments: [{ shipment: 1, result: unplaced }] };
    }
    payload.shipments[0].result = [...payload.shipments[0].result, ...unplaced];
    return payload;
  }

  /** Order result'ı sessizce (spinner'sız) DB'ye yazar. Id yoksa false döner. */
  async persistOrderResult(): Promise<boolean> {
    const orderResultId = await firstValueFrom(this.store.select(selectOrderResultId));
    if (!orderResultId) return false;
    const payload = await this.buildPersistPayload();
    await firstValueFrom(this.repositoryService.partialUpdateOrderResult(orderResultId, payload, true));
    return true;
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
