// features/stepper/components/result-step/fill-analysis-dialog/fill-analysis-dialog.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';

import {
  FillAnalysisProduct,
  FillAnalysisScenario,
  OrderFillAnalysis,
} from '@features/interfaces/order-fill-analysis.interface';
import { OrderFillAnalysisService } from '@features/services/order-fill-analysis.service';
import { ToastService } from '@core/services/toast.service';

export interface FillAnalysisDialogData {
  orderId: string;
  /** Verilirse yeniden istek atmadan bunu gösterir (otomatik açılışta). */
  analysis?: OrderFillAnalysis | null;
}

@Component({
  selector: 'app-fill-analysis-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  templateUrl: './fill-analysis-dialog.component.html',
  styleUrl: './fill-analysis-dialog.component.scss',
})
export class FillAnalysisDialogComponent implements OnInit {
  readonly data: FillAnalysisDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<FillAnalysisDialogComponent>);
  private analysisService = inject(OrderFillAnalysisService);
  private toastService = inject(ToastService);

  isLoading = false;
  analysis: OrderFillAnalysis | null = this.data.analysis ?? null;

  ngOnInit(): void {
    if (!this.analysis) {
      this.loadLatest();
    }
  }

  /** Dialog ilk açıldığında: son kayıt yoksa analizi çalıştır. */
  private loadLatest(): void {
    this.isLoading = true;
    this.analysisService.getLatest(this.data.orderId).subscribe({
      next: (latest) => {
        if (latest) {
          this.analysis = latest;
          this.isLoading = false;
        } else {
          this.rerun();
        }
      },
      error: () => {
        this.toastService.error('GENERIC_TABLE.DATA_LOAD_ERROR');
        this.isLoading = false;
      },
    });
  }

  /** Yeni bir analiz kaydı üretir (eskiler silinmez). */
  rerun(): void {
    this.isLoading = true;
    this.analysisService.analyze(this.data.orderId).subscribe({
      next: (created) => {
        this.analysis = created;
        this.isLoading = false;
      },
      error: (err) => {
        const msg = err?.error?.detail || err?.error?.[0] || 'GENERIC_TABLE.DATA_LOAD_ERROR';
        this.toastService.error(msg);
        this.isLoading = false;
      },
    });
  }

  get scenarios(): FillAnalysisScenario[] {
    return this.analysis?.result?.scenarios ?? [];
  }

  productLabel(p: FillAnalysisProduct): string {
    return [p.barcode, p.type_name].filter(Boolean).join(' - ') || p.name;
  }

  close(): void {
    this.dialogRef.close();
  }
}
