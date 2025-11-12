import { Injectable, inject } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Observable, tap, finalize, EMPTY, take, switchMap } from 'rxjs';
import { RepositoryService } from '../../../services/repository.service';
import { FileState, FileValidationResult } from '../models/invoice-upload-interfaces';
import { INVOICE_UPLOAD_CONSTANTS } from '../constants/invoice-upload.constants';
import { ToastService } from '../../../../../../services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../../../../../store';
import { setFileExists } from '../../../../../../store/stepper/stepper.actions';
import { selectFileExists } from '../../../../../../store/stepper/stepper.selectors';
@Injectable({
  providedIn: 'root'
})
export class FileUploadManager {
  // TODO:
  // burasi tasinacak
  // butun projedeki file upload islemleri icin kullanilacak
  // helper gorevi gorecek
  private readonly repositoryService = inject(RepositoryService);
  private readonly toastService = inject(ToastService);
  private readonly store = inject(Store<AppState>);

  private fileState: FileState = {
    file: null,
    tempFile: null
  };

  // File validation
  fileValidator = (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File;
    if (!file) return null;

    const validation = this.validateFile(file);
    if (!validation.isValid) {
      return { invalidFile: validation.error };
    }

    return null;
  };

  validateFile(file: File): FileValidationResult {
    if (!INVOICE_UPLOAD_CONSTANTS.FILE.VALID_TYPES.includes(file.type as typeof INVOICE_UPLOAD_CONSTANTS.FILE.VALID_TYPES[number])) {
      return {
        isValid: false,
        error: INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.INVALID_FILE_TYPE
      };
    }

    if (file.size > INVOICE_UPLOAD_CONSTANTS.FILE.MAX_SIZE) {
      return {
        isValid: false,
        error: INVOICE_UPLOAD_CONSTANTS.MESSAGES.ERROR.FILE_TOO_LARGE
      };
    }

    return { isValid: true };
  }

  selectFile(event: Event): boolean {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const validation = this.validateFile(file);

      if (validation.isValid) {
        this.fileState.file = file;
        this.store.dispatch(setFileExists());
        this.toastService.success(INVOICE_UPLOAD_CONSTANTS.MESSAGES.SUCCESS.FILE_SELECTED);
        return true;
      } else {
        this.toastService.error(validation.error!);
        this.resetFileInput();
        return false;
      }
    }
    return false;
  }

  uploadFile(): Observable<any> {
    if (!this.fileState.file) {
      this.toastService.warning(INVOICE_UPLOAD_CONSTANTS.MESSAGES.WARNING.SELECT_FILE);
      throw new Error('No file selected');
    }

    this.toastService.info(INVOICE_UPLOAD_CONSTANTS.MESSAGES.INFO.FILE_UPLOADING);

    return this.repositoryService.processFile(this.fileState.file).pipe(
      tap(() => {
        this.toastService.info(INVOICE_UPLOAD_CONSTANTS.MESSAGES.INFO.FILE_PROCESSING);
      }),
      finalize(() => {
        // File processing completed
      })
    );
  }

  uploadFileToOrder(orderId: string): Observable<any> {
    if (!this.fileState.tempFile) {
      throw new Error('No temp file available');
    }
    return this.store.select(selectFileExists).pipe(
      take(1),
      switchMap(fileExists => {
        if (fileExists && this.fileState.tempFile) {
          this.store.dispatch(setFileExists());
          return this.repositoryService.uploadFile(this.fileState.tempFile, orderId, "first_excel");
        }
        return EMPTY;
      })
    );
  }

  resetFileInput(): void {
    this.fileState.file = null;
    // Form reset should be handled by OrderFormManager
  }

  moveFileToTemp(): void {
    this.fileState.tempFile = this.fileState.file;
    this.fileState.file = null;
  }

  resetAllFiles(): void {
    this.fileState.file = null;
    this.fileState.tempFile = null;
  }

  getCurrentFile(): File | null {
    return this.fileState.file;
  }

  getTempFile(): File | null {
    return this.fileState.tempFile;
  }

  hasFile(): boolean {
    return !!this.fileState.file;
  }

  hasTempFile(): boolean {
    return !!this.fileState.tempFile;
  }

  getFileName(): string | undefined {
    return this.fileState.tempFile?.name;
  }

  getFileState(): FileState {
    return { ...this.fileState };
  }
}
