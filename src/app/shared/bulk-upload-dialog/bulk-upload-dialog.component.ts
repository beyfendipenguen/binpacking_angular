import { Component, inject, OnInit, Inject } from '@angular/core';
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
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>{{ config.icon }}</mat-icon>
          Toplu {{ config.entityName }} Ekleme
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
              <strong>Toplu {{ config.entityName.toLowerCase() }} ekleme nasıl çalışır?</strong>
              <p>
                @for (instruction of getInstructions(); track instruction) {
                  {{ instruction }}<br>
                }
              </p>
            </div>
          </div>

          <!-- Şablon İndirme Alanı -->
          @if(!isTemplateDownloaded) {
            <div class="download-section">
              <div class="download-card">
                <div class="download-icon">
                  <mat-icon>description</mat-icon>
                </div>
                <div class="download-content">
                  <h3>Excel Şablonu</h3>
                  <p>Toplu {{ config.entityName.toLowerCase() }} eklemek için önce Excel şablonunu indirin</p>
                  <button
                    mat-raised-button
                    color="primary"
                    (click)="downloadTemplate()"
                    [disabled]="isDownloading"
                    class="download-btn">
                    <mat-icon>{{ isDownloading ? 'hourglass_empty' : 'download' }}</mat-icon>
                    {{ isDownloading ? 'İndiriliyor...' : 'Şablonu İndir' }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Dosya Yükleme Alanı -->
          @if(isTemplateDownloaded) {
            <div class="upload-section">
              <div
                class="upload-card"
                [class.drag-over]="isDragOver"
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
                    <h3>{{ isDragOver ? 'Dosyayı Bırakın' : 'Doldurulmuş Excel Dosyasını Yükleyin' }}</h3>
                    <p>{{ isDragOver ? 'Dosya yükleme alanına bırakın' : 'Dosyayı sürükleyip bırakın veya tıklayarak seçin' }}</p>
                    @if(!isDragOver) {
                      <button mat-raised-button color="primary" type="button">
                        <mat-icon>folder_open</mat-icon>
                        Dosya Seç
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
                      Dosyayı Değiştir
                    </button>
                  </div>
                }
              </div>

              <!-- Tekrar Şablon İndirme Linki -->
              <div class="redownload-link">
                <button
                  mat-button
                  (click)="downloadTemplate()"
                  [disabled]="isDownloading"
                  class="link-button">
                  <mat-icon>download</mat-icon>
                  {{ isDownloading ? 'İndiriliyor...' : 'Şablonu tekrar indir' }}
                </button>
              </div>
            </div>
          }

        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onClose()">İptal</button>
        <button
          mat-raised-button
          color="primary"
          (click)="onSave()"
          [disabled]="!canSave()">
          <mat-icon>save</mat-icon>
          Kaydet ve İçe Aktar
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
      color: #333333; /* text-dark */
      padding: 16px 0;

      mat-icon {
        color: #006a6a; /* primary-color */
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
        background-color: #e6f2f2; /* light primary bg */
        border-left: 4px solid #006a6a; /* primary-color */
        border-radius: 4px;
        padding: 16px;
        margin-bottom: 24px;

        > mat-icon {
          color: #006a6a; /* primary-color */
          font-size: 24px;
          height: 24px;
          width: 24px;
          flex-shrink: 0;
        }

        .info-text {
          flex: 1;

          strong {
            display: block;
            color: #004a4a; /* accent-color */
            margin-bottom: 8px;
            font-size: 0.95rem;
          }

          p {
            margin: 0;
            color: #00595a; /* darker primary */
            font-size: 0.9rem;
            line-height: 1.6;
          }
        }
      }

      .download-section {
        .download-card {
          display: flex;
          align-items: center;
          gap: 20px;
          background-color: #f8f9fa; /* background-color */
          border: 2px dashed #d6bb86; /* secondary-color */
          border-radius: 8px;
          padding: 32px;
          text-align: center;
          transition: all 0.3s ease;

          &:hover {
            border-color: #006a6a; /* primary-color */
            background-color: #ffffff; /* white */
          }

          .download-icon {
            flex-shrink: 0;
            width: 80px;
            height: 80px;
            background-color: #006a6a; /* primary-color */
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;

            mat-icon {
              font-size: 40px;
              height: 40px;
              width: 40px;
              color: white;
            }
          }

          .download-content {
            flex: 1;
            text-align: left;

            h3 {
              margin: 0 0 8px 0;
              color: #333333; /* text-dark */
              font-size: 1.3rem;
              font-weight: 500;
            }

            p {
              margin: 0 0 16px 0;
              color: #666666; /* text-light */
              line-height: 1.5;
            }

            .download-btn {
              mat-icon {
                margin-right: 8px;
              }
            }
          }
        }
      }

      .upload-section {
        .upload-card {
          border: 2px dashed #006a6a; /* primary-color */
          border-radius: 8px;
          overflow: hidden;
          background-color: #fafafa;
          transition: all 0.3s ease;

          &:hover {
            background-color: #f8f9fa; /* background-color */
            border-color: #004a4a; /* accent-color */
          }

          &.drag-over {
            background-color: #e6f2f2; /* light primary bg */
            border-color: #006a6a; /* primary-color */
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
                color: #006a6a; /* primary-color */
                transition: all 0.3s ease;
              }
            }

            h3 {
              margin: 0 0 8px 0;
              color: #333333; /* text-dark */
              font-size: 1.2rem;
              font-weight: 500;
              transition: all 0.3s ease;
            }

            p {
              margin: 0 0 20px 0;
              color: #666666; /* text-light */
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
              border: 1px solid #e0e0e0; /* border-color */
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
                  color: #333333; /* text-dark */
                  font-size: 1rem;
                  margin-bottom: 4px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }

                .file-size {
                  color: #666666; /* text-light */
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

        .redownload-link {
          text-align: center;
          margin-top: 16px;

          .link-button {
            color: #006a6a; /* primary-color */

            mat-icon {
              margin-right: 4px;
              font-size: 18px;
              height: 18px;
              width: 18px;
            }

            &:hover {
              background-color: rgba(0, 106, 106, 0.04); /* primary with opacity */
            }
          }
        }
      }
    }
  }

  mat-dialog-actions {
    padding: 16px 24px;
    border-top: 1px solid #e0e0e0; /* border-color */
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
    .dialog-container {
      .dialog-content {
        .download-section {
          .download-card {
            flex-direction: column;
            text-align: center;

            .download-content {
              text-align: center;
            }
          }
        }
      }
    }
  }
`]
})
export class GenericBulkUploadDialogComponent implements OnInit {
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
  ) {}

  ngOnInit(): void {
    this.getTemplateFile();
  }

  getInstructions(): string[] {
    return this.config.instructions || [
      '1️⃣  Aşağıdaki tabloda belirtilen sütunları doldurun',
      '2️⃣  Sütun isimlerini kesinlikle değiştirmeyin',
      '3️⃣  Tüm zorunlu alanları eksiksiz doldurun',
      '4️⃣  Dosyayı kaydedip sisteme yükleyin'
    ];
  }

  getAcceptedTypes(): string {
    return (this.config.acceptedFileTypes || ['.xlsx', '.xls']).join(',');
  }

  downloadTemplate(): void {
    if (!this.templateFile) {
      this.toastService.error('Şablon dosyası bulunamadı.');
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
          if (!response.ok) throw new Error('Dosya indirilemedi');
          return response.blob();
        })
        .then(download)
        .catch(error => {
          this.toastService.error('Şablon indirilemedi.');
          this.isDownloading = false;
        });
    } else if (this.templateFile.file instanceof File) {
      download(this.templateFile.file);
    } else {
      this.toastService.error('Geçersiz dosya formatı.');
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
        } else {
          this.toastService.error('Şablon dosyası bulunamadı.');
        }
      },
      error: (error) => {
        this.toastService.error('Şablon dosyası yüklenemedi.');
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
        this.toastService.error(`Lütfen sadece ${allowedExtensions.join(', ')} dosyası yükleyin.`);
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
    return this.isTemplateDownloaded && this.selectedFile !== null && !this.isUploading;
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
                            'Dosya yüklenirken bir hata oluştu.';

        this.toastService.error(errorMessage);
      }
    });
  }
}
