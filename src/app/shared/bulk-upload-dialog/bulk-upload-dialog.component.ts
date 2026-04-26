import { Component, inject, OnInit, Inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FileService } from '@app/core/services/file.service';
import { ToastService } from '@app/core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState, selectUser } from '@app/store';
import { BulkUploadConfig } from './bulk-upload.config';
import { Document } from '@app/features/interfaces/file.interface';
import { GenericBulkUploadResultDialogComponent } from './bulk-upload-result-dialog.component';

@Component({
  selector: 'app-generic-bulk-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>{{ config.icon }}</mat-icon>
          {{'BULK_ADD.BULK'| translate}} {{ config.entityName }} {{'BULK_ADD.ADD'| translate}}
        </h2>
        <button mat-icon-button (click)="onClose()" class="close-button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <div class="dialog-content">

          <!-- Bilgilendirme Kutusu -->
          <div class="info-box">
            <mat-icon>info</mat-icon>
            <div class="info-text">
              <strong>{{'BULK_ADD.HOW_IT_WORKS' | translate}}</strong>
              <p>
                @for (instruction of getInstructions(); track instruction) {
                  {{ instruction }}<br>
                }
              </p>
            </div>
          </div>

          <!-- Şablon İndirme — Kompakt, isteğe bağlı banner -->
          @if(config.showTemplateDownload && templateFile) {
            <div class="template-banner" [class.downloaded]="isTemplateDownloaded">
              <div class="template-banner-content">
                <mat-icon class="template-icon">
                  {{ isTemplateDownloaded ? 'check_circle' : 'description' }}
                </mat-icon>
                <div class="template-text">
                  @if(!isTemplateDownloaded) {
                    <strong>{{'BULK_ADD.NEED_TEMPLATE' | translate}}</strong>
                    <span>{{'BULK_ADD.DOWNLOAD_OPTIONAL' | translate}}</span>
                  } @else {
                    <strong>{{'BULK_ADD.TEMPLATE_DOWNLOADED' | translate}}</strong>
                    <span>{{'BULK_ADD.FILL_AND_UPLOAD' | translate}}</span>
                  }
                </div>
              </div>
              <button
                mat-stroked-button
                color="primary"
                (click)="downloadTemplate()"
                [disabled]="isDownloading"
                class="template-btn">
                <mat-icon>{{ isDownloading ? 'hourglass_empty' : (isTemplateDownloaded ? 'sync' : 'download') }}</mat-icon>
                {{ getDownloadButtonText() | translate }}
              </button>
            </div>
          }

          <!-- Dosya Yükleme Alanı — Her zaman görünür, ana eylem -->
          <div class="upload-section">
            <div
              class="upload-card"
              [class.drag-over]="isDragOver"
              [class.has-file]="!!selectedFile"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)">
              <input
                type="file"
                #fileInput
                (change)="onFileSelected($event)"
                [accept]="getAcceptedTypes()"
                style="display: none">

              @if(!selectedFile) {
                <div class="upload-placeholder" (click)="fileInput.click()">
                  <div class="upload-icon">
                    <mat-icon>{{ isDragOver ? 'file_download' : 'cloud_upload' }}</mat-icon>
                  </div>
                  <h3>{{ (isDragOver ? 'BULK_ADD.DROP_FILE' : 'BULK_ADD.UPLOAD_EXCEL') | translate }}</h3>
                  <p>{{ (isDragOver ? 'BULK_ADD.DROP_HERE' : 'BULK_ADD.DRAG_OR_CLICK') | translate}}</p>
                  @if(!isDragOver) {
                    <button mat-raised-button color="primary" type="button">
                      <mat-icon>folder_open</mat-icon>
                      {{ 'BULK_ADD.SELECT_FILE' | translate }}
                    </button>
                  }
                </div>
              } @else {
                <div class="file-selected">
                  <div class="file-info">
                    <mat-icon class="file-icon">description</mat-icon>
                    <div class="file-details">
                      <strong>{{ selectedFile.name }}</strong>
                      <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
                    </div>
                    <button
                      mat-icon-button
                      color="warn"
                      (click)="removeFile(); $event.stopPropagation()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  <button
                    mat-stroked-button
                    color="primary"
                    (click)="fileInput.click()"
                    class="change-file-btn">
                    <mat-icon>sync</mat-icon>
                    {{ 'BULK_ADD.CHANGE_FILE' | translate }}
                  </button>
                </div>
              }
            </div>
          </div>

        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onClose()">{{'COMMON.CANCEL' | translate}}</button>
        <button
          mat-raised-button
          color="primary"
          (click)="onSave()"
          [disabled]="!canSave()">
          @if(isUploading) {
            <mat-spinner diameter="18" style="display: inline-block; margin-right: 8px;"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          {{ (isUploading ? 'BULK_ADD.UPLOADING' : 'BULK_ADD.SAVE_AND_IMPORT') | translate }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
  .dialog-container {
    width: 100%;
    max-width: 800px;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 0;

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
    min-height: 400px;

    .dialog-content {
      .info-box {
        display: flex;
        gap: 12px;
        background-color: #e6f2f2;
        border-left: 4px solid #006a6a;
        border-radius: 4px;
        padding: 16px;
        margin-bottom: 20px;

        > mat-icon {
          color: #006a6a;
          font-size: 24px;
          height: 24px;
          width: 24px;
          flex-shrink: 0;
        }

        .info-text {
          flex: 1;

          strong {
            display: block;
            color: #004a4a;
            margin-bottom: 8px;
            font-size: 0.95rem;
          }

          p {
            margin: 0;
            color: #00595a;
            font-size: 0.9rem;
            line-height: 1.6;
          }
        }
      }

      /* Kompakt template indirme bandı */
      .template-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        background-color: #fef9f0;
        border: 1px solid #d6bb86;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 20px;
        transition: all 0.3s ease;

        &.downloaded {
          background-color: #f0f9f0;
          border-color: #4caf50;

          .template-icon {
            color: #4caf50;
          }
        }

        .template-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;

          .template-icon {
            color: #d6a045;
            font-size: 28px;
            height: 28px;
            width: 28px;
            flex-shrink: 0;
            transition: color 0.3s ease;
          }

          .template-text {
            display: flex;
            flex-direction: column;
            min-width: 0;

            strong {
              color: #333333;
              font-size: 0.95rem;
              font-weight: 500;
            }

            span {
              color: #666666;
              font-size: 0.85rem;
            }
          }
        }

        .template-btn {
          flex-shrink: 0;

          mat-icon {
            margin-right: 6px;
            font-size: 18px;
            height: 18px;
            width: 18px;
          }
        }
      }

      .upload-section {
        .upload-card {
          border: 2px dashed #006a6a;
          border-radius: 8px;
          overflow: hidden;
          background-color: #fafafa;
          transition: all 0.3s ease;

          &:hover {
            background-color: #f8f9fa;
            border-color: #004a4a;
          }

          &.has-file {
            border-style: solid;
            border-color: #4caf50;
            background-color: #ffffff;
          }

          &.drag-over {
            background-color: #e6f2f2;
            border-color: #006a6a;
            border-width: 3px;
            transform: scale(1.02);

            .upload-placeholder {
              .upload-icon {
                mat-icon {
                  animation: bounce 0.6s ease-in-out infinite;
                }
              }
            }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          .upload-placeholder {
            padding: 48px 32px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;

            * {
              pointer-events: none;
            }

            .upload-icon {
              margin-bottom: 16px;

              mat-icon {
                font-size: 64px;
                height: 64px;
                width: 64px;
                color: #006a6a;
                transition: all 0.3s ease;
              }
            }

            h3 {
              margin: 0 0 8px 0;
              color: #333333;
              font-size: 1.2rem;
              font-weight: 500;
              transition: all 0.3s ease;
            }

            p {
              margin: 0 0 20px 0;
              color: #666666;
              transition: all 0.3s ease;
            }

            button {
              mat-icon {
                margin-right: 8px;
              }
            }
          }

          .file-selected {
            padding: 24px;

            > * {
              pointer-events: auto;
            }

            .file-info {
              display: flex;
              align-items: center;
              gap: 16px;
              background-color: white;
              border: 1px solid #e0e0e0;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 16px;

              .file-icon {
                font-size: 40px;
                height: 40px;
                width: 40px;
                color: #4caf50;
                flex-shrink: 0;
              }

              .file-details {
                flex: 1;
                min-width: 0;

                strong {
                  display: block;
                  color: #333333;
                  font-size: 1rem;
                  margin-bottom: 4px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }

                .file-size {
                  color: #666666;
                  font-size: 0.85rem;
                }
              }
            }

            .change-file-btn {
              width: 100%;

              mat-icon {
                margin-right: 8px;
              }
            }
          }
        }
      }
    }
  }

  mat-dialog-actions {
    padding: 16px 24px;
    border-top: 1px solid #e0e0e0;
    margin-top: 0;
    gap: 8px;

    button {
      mat-icon {
        margin-right: 4px;
        font-size: 18px;
        height: 18px;
        width: 18px;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }

  @media (max-width: 600px) {
    .template-banner {
      flex-direction: column;
      align-items: stretch !important;

      .template-btn {
        width: 100%;
      }
    }
  }
`]
})
export class GenericBulkUploadDialogComponent implements OnInit {

  private translate = inject(TranslateService);
  isTemplateDownloaded = false;
  selectedFile: File | null = null;
  isDownloading = false;
  isUploading = false;
  isDragOver = false;

  fileService = inject(FileService);
  toastService = inject(ToastService);
  dialog = inject(MatDialog);
  private readonly store = inject(Store<AppState>);
  public userSignal = this.store.selectSignal(selectUser);
  public templateFile: Document | undefined;

  constructor(
    private dialogRef: MatDialogRef<GenericBulkUploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public config: BulkUploadConfig
  ) { }

  ngOnInit(): void {
    // Template indirme banner'ı isteniyorsa template'i fetch et
    if (this.config.showTemplateDownload !== false) {
      this.getTemplateFile();
    }
  }

  getInstructions(): string[] {
    return this.config.instructions || [
      `1️⃣  ${this.translate.instant('BULK_ADD.STEP_1')}`,
      `2️⃣  ${this.translate.instant('BULK_ADD.STEP_2')}`,
      `3️⃣  ${this.translate.instant('BULK_ADD.STEP_3')}`,
      `4️⃣  ${this.translate.instant('BULK_ADD.STEP_4')}`
    ];
  }

  getAcceptedTypes(): string {
    return (this.config.acceptedFileTypes || ['.xlsx', '.xls']).join(',');
  }

  getDownloadButtonText(): string {
    if (this.isDownloading) return 'BULK_ADD.DOWNLOADING';
    if (this.isTemplateDownloaded) return 'BULK_ADD.REDOWNLOAD_TEMPLATE';
    return 'BULK_ADD.DOWNLOAD_TEMPLATE';
  }

  downloadTemplate(): void {
    if (!this.templateFile) {
      this.toastService.error(this.translate.instant('BULK_ADD.TEMPLATE_NOT_FOUND'));
      return;
    }

    this.isDownloading = true;

    const download = (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.config.templateFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      this.isTemplateDownloaded = true;
      this.isDownloading = false;
    };

    if (typeof this.templateFile.file === 'string') {
      fetch(this.templateFile.file)
        .then(response => {
          if (!response.ok) throw new Error(this.translate.instant('BULK_ADD.FILE_NOT_DOWNLOAD'));
          return response.blob();
        })
        .then(download)
        .catch(error => {
          this.toastService.error(this.translate.instant('BULK_ADD.TEMPLATE_DOWNLOAD_ERROR'));
          this.isDownloading = false;
        });
    } else if (this.templateFile.file instanceof File) {
      download(this.templateFile.file);
    } else {
      this.toastService.error(this.translate.instant('BULK_ADD.INVALID_FILE_FORMAT'));
      this.isDownloading = false;
    }
  }

  getTemplateFile(): void {
    const company_id = this.userSignal()?.company.id;

    this.fileService.getAll({
      company_id: company_id,
      type: this.config.templateType
    }).subscribe({
      next: (response) => {
        if (response.results && response.results.length > 0) {
          this.templateFile = response.results[0];
        }
        // Template yoksa sessizce geç — banner zaten gösterilmeyecek
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('BULK_ADD.TEMPLATE_LOAD_ERROR'));
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const allowedExtensions = (this.config.acceptedFileTypes || ['.xlsx', '.xls'])
        .map(ext => ext.replace('.', ''));
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension && allowedExtensions.includes(fileExtension)) {
        this.selectedFile = file;
      } else {
        this.toastService.error(`${this.translate.instant('BULK_ADD.UPLOAD_ONLY')} ${allowedExtensions.join(', ')} ${this.translate.instant('BULK_ADD.FILE_TYPE')}`);
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  removeFile(): void {
    this.selectedFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  canSave(): boolean {
    // Artık template indirme zorunlu değil — sadece dosya seçimi yeterli
    return this.selectedFile !== null && !this.isUploading;
  }

  onClose(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (!this.canSave() || !this.selectedFile) {
      return;
    }

    this.isUploading = true;

    this.config.uploadFn(this.selectedFile).subscribe({
      next: (response) => {
        this.isUploading = false;

        this.dialog.open(GenericBulkUploadResultDialogComponent, {
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          data: {
            response: response,
            config: this.config
          },
          disableClose: false
        });

        this.dialogRef.close({
          saved: true,
          result: response
        });
      },
      error: (error) => {
        this.isUploading = false;

        const errorMessage = error.error?.error ||
          error.error?.message ||
          this.translate.instant('BULK_ADD.FILE_UPLOAD_ERROR');

        this.toastService.error(errorMessage);
      }
    });
  }
}
