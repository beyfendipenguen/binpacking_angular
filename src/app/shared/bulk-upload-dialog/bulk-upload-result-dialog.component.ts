import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { BulkUploadResponse, BulkUploadConfig } from './bulk-upload.config';

interface ResultDialogData {
  response: BulkUploadResponse;
  config: BulkUploadConfig;
}

@Component({
  selector: 'app-generic-bulk-upload-result-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>assessment</mat-icon>
          Toplu {{ data.config.entityName }} Yükleme Sonucu
        </h2>
        <button mat-icon-button (click)="onClose()" class="close-button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <div class="dialog-content">

          <!-- Özet Kartları -->
          <div class="summary-cards">
            <div class="summary-card total">
              <div class="card-icon">
                <mat-icon>description</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-value">{{ data.response.total_rows }}</span>
                <span class="card-label">Toplam Satır</span>
              </div>
            </div>

            <div class="summary-card success">
              <div class="card-icon">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-value">{{ data.response.successful }}</span>
                <span class="card-label">Başarılı</span>
              </div>
            </div>

            <div class="summary-card warning">
              <div class="card-icon">
                <mat-icon>info</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-value">{{ data.response.skipped }}</span>
                <span class="card-label">Atlanan</span>
              </div>
            </div>

            <div class="summary-card error">
              <div class="card-icon">
                <mat-icon>error</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-value">{{ data.response.failed }}</span>
                <span class="card-label">Hatalı</span>
              </div>
            </div>
          </div>

          <!-- Başarılı Eklenenler -->
          @if(data.response.success_details && data.response.success_details.length > 0) {
            <div class="result-section success-section">
              <div class="section-header">
                <mat-icon>check_circle</mat-icon>
                <h3>Başarıyla Eklenen {{ data.config.entityNamePlural }} ({{ data.response.success_details.length }})</h3>
              </div>
              <div class="table-container">
                <table mat-table [dataSource]="data.response.success_details" class="result-table">
                  <ng-container matColumnDef="row">
                    <th mat-header-cell *matHeaderCellDef>Satır</th>
                    <td mat-cell *matCellDef="let element">{{ element.row }}</td>
                  </ng-container>

                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>{{ data.config.entityName }} Adı</th>
                    <td mat-cell *matCellDef="let element">{{ element.name }}</td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Durum</th>
                    <td mat-cell *matCellDef="let element">
                      <span class="status-badge success">
                        <mat-icon>check</mat-icon>
                        Eklendi
                      </span>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="successColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: successColumns;"></tr>
                </table>
              </div>
            </div>
          }

          <!-- Mevcut/Hatalı Kayıtlar -->
          @if(data.response.errors && data.response.errors.length > 0) {
            <div class="result-section error-section">
              <div class="section-header">
                <mat-icon>{{ getMajorErrorType() === 'warning' ? 'info' : 'error' }}</mat-icon>
                <h3>{{ getErrorSectionTitle() }} ({{ data.response.errors.length }})</h3>
              </div>
              <div class="table-container">
                <table mat-table [dataSource]="data.response.errors" class="result-table">
                  <ng-container matColumnDef="row">
                    <th mat-header-cell *matHeaderCellDef>Satır</th>
                    <td mat-cell *matCellDef="let element">{{ element.row }}</td>
                  </ng-container>

                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>{{ data.config.entityName }} Adı</th>
                    <td mat-cell *matCellDef="let element">{{ element.name }}</td>
                  </ng-container>

                  <ng-container matColumnDef="error">
                    <th mat-header-cell *matHeaderCellDef>Durum/Hata</th>
                    <td mat-cell *matCellDef="let element">
                      <span [class]="getErrorClass(element.name)">
                        <mat-icon style="padding-right: 14px;">{{ getErrorIcon(element.name) }}</mat-icon>
                        {{ element.message }}
                      </span>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="errorColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: errorColumns;"></tr>
                </table>
              </div>
            </div>
          }

          <!-- Boş Sonuç Mesajı -->
          @if(data.response.total_rows === 0) {
            <div class="empty-state">
              <mat-icon>inbox</mat-icon>
              <p>Dosyada işlenecek veri bulunamadı.</p>
            </div>
          }

        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-raised-button color="primary" (click)="onClose()">
          <mat-icon>close</mat-icon>
          Kapat
        </button>
      </mat-dialog-actions>
    </div>
  `,
styles: [`
  .dialog-container {
    width: 100%;
    max-width: 900px;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    border-bottom: 1px solid #e0e0e0;

    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
      color: #333333;
      padding: 16px 0;

      mat-icon {
        color: #006a6a;
      }
    }

    .close-button {
      margin-top: -8px;
    }
  }

  mat-dialog-content {
    padding: 24px;
    margin: 0;
    max-height: 70vh;
    overflow-y: auto; /* ✅ Eklendi */

    /* ✅ Custom scrollbar */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #006a6a;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #004a4a;
    }

    .dialog-content {
      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
        margin-bottom: 32px;

        .summary-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          border: 2px solid;
          transition: all 0.3s ease;

          &.total {
            border-color: #006a6a;
            background-color: #e6f2f2;

            .card-icon {
              background-color: #006a6a;
            }
          }

          &.success {
            border-color: #4caf50;
            background-color: #e8f5e9;

            .card-icon {
              background-color: #4caf50;
            }
          }

          &.warning {
            border-color: #d6bb86;
            background-color: #faf7f0;

            .card-icon {
              background-color: #d6bb86;
            }
          }

          &.error {
            border-color: #d32f2f;
            background-color: #ffebee;

            .card-icon {
              background-color: #d32f2f;
            }
          }

          .card-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;

            mat-icon {
              color: white;
              font-size: 24px;
              height: 24px;
              width: 24px;
            }
          }

          .card-content {
            display: flex;
            flex-direction: column;

            .card-value {
              font-size: 1.5rem;
              font-weight: 600;
              color: #333333;
              line-height: 1;
              margin-bottom: 4px;
            }

            .card-label {
              font-size: 0.85rem;
              color: #666666;
            }
          }
        }
      }

      .result-section {
        margin-bottom: 24px;
        border-radius: 8px;
        overflow: hidden;

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 2px solid;

          mat-icon {
            font-size: 24px;
            height: 24px;
            width: 24px;
          }

          h3 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 500;
          }
        }

        &.success-section {
          border: 2px solid #4caf50;

          .section-header {
            background-color: #e8f5e9;
            border-color: #4caf50;

            mat-icon {
              color: #4caf50;
            }

            h3 {
              color: #2e7d32;
            }
          }
        }

        &.error-section {
          border: 2px solid #d6bb86;

          .section-header {
            background-color: #faf7f0;
            border-color: #d6bb86;

            mat-icon {
              color: #c0a670;
            }

            h3 {
              color: #8b7d5a;
            }
          }
        }

        .table-container {
          max-height: 400px;
          overflow-y: auto; /* ✅ Zaten vardı */
          position: relative; /* ✅ Eklendi */

          /* ✅ Custom scrollbar for table */
          &::-webkit-scrollbar {
            width: 8px;
          }

          &::-webkit-scrollbar-track {
            background: #f8f9fa;
            border-radius: 4px;
          }

          &::-webkit-scrollbar-thumb {
            background: #006a6a;
            border-radius: 4px;
          }

          &::-webkit-scrollbar-thumb:hover {
            background: #004a4a;
          }

          .result-table {
            width: 100%;

            th {
              background-color: #f8f9fa;
              font-weight: 600;
              color: #333333;
              position: sticky; /* ✅ Eklendi - Header sabit kalır */
              top: 0; /* ✅ Eklendi */
              z-index: 10; /* ✅ Eklendi */
            }

            td, th {
              padding: 12px 16px;
            }

            .status-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 12px;
              border-radius: 16px;
              font-size: 0.85rem;
              font-weight: 500;

              mat-icon {
                font-size: 16px;
                height: 16px;
                width: 16px;
              }

              &.success {
                background-color: #e8f5e9;
                color: #2e7d32;
              }

              &.warning {
                background-color: #faf7f0;
                color: #8b7d5a;

                mat-icon {
                  color: #c0a670;
                }
              }

              &.error {
                background-color: #ffebee;
                color: #c62828;

                mat-icon {
                  color: #d32f2f;
                }
              }
            }
          }
        }
      }

      .empty-state {
        text-align: center;
        padding: 48px 24px;
        color: #999;

        mat-icon {
          font-size: 64px;
          height: 64px;
          width: 64px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        p {
          margin: 0;
          font-size: 1.1rem;
        }
      }
    }
  }

  mat-dialog-actions {
    padding: 16px 24px;
    border-top: 1px solid #e0e0e0;
    margin-top: 0;

    button {
      mat-icon {
        margin-right: 4px;
        font-size: 18px;
        height: 18px;
        width: 18px;
      }
    }
  }

  // Responsive
  @media (max-width: 768px) {
    .summary-cards {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }

  @media (max-width: 480px) {
    .summary-cards {
      grid-template-columns: 1fr !important;
    }
  }
`]
})
export class GenericBulkUploadResultDialogComponent {
  successColumns = ['row', 'name', 'status'];
  errorColumns = ['row', 'name', 'error'];

  constructor(
    private dialogRef: MatDialogRef<GenericBulkUploadResultDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResultDialogData
  ) {}

  getDisplayName(rowData: any): string {
    // Farklı entity tipleri için name field'ı belirle
    return rowData.type_name || rowData.name || rowData.title ||
           rowData.customer_name || rowData.company_name ||
           'İsimsiz';
  }

  onClose(): void {
    this.dialogRef.close();
  }

  getErrorClass(error: string): string {
    if (error.includes('zaten mevcut')) {
      return 'status-badge warning';
    }
    return 'status-badge error';
  }

  getErrorIcon(error: string): string {
    if (error.includes('zaten mevcut')) {
      return 'info';
    }
    return 'error';
  }

  getMajorErrorType(): 'warning' | 'error' {
    if (!this.data.response.errors || this.data.response.errors.length === 0) {
      return 'error';
    }

    const hasExistingErrors = this.data.response.errors.some(e =>
      e.message.includes('zaten mevcut')
    );

    return hasExistingErrors && this.data.response.failed === 0 ? 'warning' : 'error';
  }

  getErrorSectionTitle(): string {
    const type = this.getMajorErrorType();

    if (type === 'warning') {
      return `Mevcut ${this.data.config.entityNamePlural}`;
    }

    return 'Hatalı Kayıtlar';
  }
}
