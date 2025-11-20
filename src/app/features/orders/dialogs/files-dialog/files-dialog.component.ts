import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FileService } from '@app/core/services/file.service';
import { Document } from '@app/features/interfaces/file.interface';

interface FileItem {
  id: string;
  name: string;
  type: string | null;
  file: string; // URL
  icon: string;
}

@Component({
  selector: 'app-files-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './files-dialog.component.html',
  styleUrl: './files-dialog.component.scss'
})
export class FilesDialogComponent implements OnInit {
  fileService = inject(FileService);

  files: FileItem[] = [];
  isLoading: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<FilesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      orderId: string;
      orderName: string;
      companyName: string;
    }
  ) { }

  ngOnInit(): void {
    this.loadFiles();
  }

  /**
   * Load files for the order
   */
  loadFiles(): void {
    this.isLoading = true;

    const params = {
      order_id: this.data.orderId,
      limit: 30,
      offset: 0
    };

    this.fileService.getAll(params).subscribe({
      next: (response: any) => {
        this.files = response.results.map((file: Document) => ({
          id: file.id,
          name: file.name,
          type: file.type,
          file: file.file,
          icon: this.getFileIcon(file.type)
        }));
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Get icon based on file type
   */
  getFileIcon(fileType: string | null): string {
    if (!fileType) return 'insert_drive_file';

    const type = fileType.toLowerCase();

    if (type.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (type.includes('image') || type.includes('jpg') || type.includes('jpeg') || type.includes('png')) {
      return 'image';
    } else if (type.includes('excel') || type.includes('sheet') || type.includes('xlsx') || type.includes('xls')) {
      return 'table_chart';
    } else if (type.includes('word') || type.includes('doc')) {
      return 'description';
    } else if (type.includes('zip') || type.includes('rar') || type.includes('archive')) {
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

  /**
   * Get file type label
   */
  getFileTypeLabel(type: string | null): string {
    if (!type) return 'Dosya';

    const typeStr = type.toLowerCase();

    if (typeStr.includes('pdf')) return 'PDF';
    if (typeStr.includes('image')) return 'Resim';
    if (typeStr.includes('excel') || typeStr.includes('sheet')) return 'Excel';
    if (typeStr.includes('word') || typeStr.includes('doc')) return 'Word';
    if (typeStr.includes('zip') || typeStr.includes('rar')) return 'Arşiv';
    if (typeStr.includes('text')) return 'Metin';
    if (typeStr.includes('video')) return 'Video';
    if (typeStr.includes('audio')) return 'Ses';

    return 'Dosya';
  }

  /**
   * Download file
   */
  downloadFile(file: FileItem): void {
    window.open(file.file, '_blank');
  }

  /**
   * Close dialog
   */
  close(): void {
    this.dialogRef.close();
  }
}
