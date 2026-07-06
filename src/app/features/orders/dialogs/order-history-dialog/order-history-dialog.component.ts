// features/orders/dialogs/order-history-dialog/order-history-dialog.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';

import {
  OrderRevision,
  RevisionDiff,
  RevisionSummary,
} from '@features/interfaces/order-revision.interface';
import { OrderRevisionService } from '@features/services/order-revision.service';
import { ToastService } from '@core/services/toast.service';

export interface OrderHistoryDialogData {
  orderId: string;
  orderName: string;
  companyName: string;
}

/** Görünüm için hazırlanmış kart modeli */
interface RevisionCard {
  revision: OrderRevision;
  title: string;            // "Rev0" veya "Rev0 → Rev1"
  isInitial: boolean;
  diff: RevisionDiff | null; // gösterilecek fark (mode'a göre rev_diff ya da diff)
  isEmpty: boolean;          // fark boş → "ürün adetleri değişmedi"
}

@Component({
  selector: 'app-order-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './order-history-dialog.component.html',
  styleUrl: './order-history-dialog.component.scss',
})
export class OrderHistoryDialogComponent implements OnInit {
  readonly data: OrderHistoryDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<OrderHistoryDialogComponent>);
  private revisionService = inject(OrderRevisionService);
  private toastService = inject(ToastService);

  isLoading = false;
  viewMode: 'transitions' | 'all' | 'summary' = 'transitions';
  cards: RevisionCard[] = [];
  summary: RevisionSummary | null = null;

  ngOnInit(): void {
    this.loadRevisions();
  }

  onViewModeChange(mode: 'transitions' | 'all' | 'summary'): void {
    if (mode === this.viewMode) return;
    this.viewMode = mode;
    this.loadRevisions();
  }

  loadRevisions(): void {
    this.isLoading = true;

    if (this.viewMode === 'summary') {
      this.revisionService.getSummary(this.data.orderId).subscribe({
        next: (summary) => {
          this.summary = summary;
          this.isLoading = false;
        },
        error: () => {
          this.toastService.error('GENERIC_TABLE.DATA_LOAD_ERROR');
          this.summary = null;
          this.isLoading = false;
        },
      });
      return;
    }

    const mode = this.viewMode === 'transitions' ? 'transitions' : undefined;

    this.revisionService.getRevisions(this.data.orderId, mode).subscribe({
      next: (revisions) => {
        this.cards = this.buildCards(revisions);
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error('GENERIC_TABLE.DATA_LOAD_ERROR');
        this.cards = [];
        this.isLoading = false;
      },
    });
  }

  get summaryHasData(): boolean {
    return !!this.summary?.rows?.length;
  }

  get summaryHasChanges(): boolean {
    return !!this.summary?.rows?.some(r => r.status !== 'unchanged');
  }

  private buildCards(revisions: OrderRevision[]): RevisionCard[] {
    return revisions.map((rev, i) => {
      const isInitial = this.viewMode === 'transitions'
        ? i === 0
        : rev.version === 0;

      // transitions modunda müşteriye gidecek fark: rev_diff
      // all modunda adım adım fark: diff
      const diff = this.viewMode === 'transitions' ? rev.rev_diff : rev.diff;

      let title: string;
      if (this.viewMode === 'transitions') {
        title = isInitial
          ? `Rev${rev.rev_no}`
          : `Rev${revisions[i - 1].rev_no} → Rev${rev.rev_no}`;
      } else {
        title = `${rev.order_name} · v${rev.version}`;
      }

      return {
        revision: rev,
        title,
        isInitial,
        diff,
        isEmpty: this.isEmptyDiff(diff),
      };
    });
  }

  isEmptyDiff(diff: RevisionDiff | null): boolean {
    if (!diff) return true;
    return !diff.added?.length && !diff.removed?.length && !diff.changed?.length;
  }

  totalCount(card: RevisionCard): number {
    return card.revision.snapshot?.reduce((sum, r) => sum + r.count, 0) ?? 0;
  }

  close(): void {
    this.dialogRef.close();
  }
}