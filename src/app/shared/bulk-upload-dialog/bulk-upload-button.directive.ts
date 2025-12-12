import { Directive, Input, HostListener, inject, ElementRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BulkUploadConfig } from './bulk-upload.config';
import { GenericBulkUploadDialogComponent } from './bulk-upload-dialog.component';

@Directive({
  selector: '[appBulkUploadButton]',
  standalone: true
})
export class BulkUploadButtonDirective {
  @Input('appBulkUploadButton') config!: BulkUploadConfig;

  private dialog = inject(MatDialog);
  private elementRef = inject(ElementRef);

  @HostListener('click')
  onClick(): void {
    if (!this.config) {
      return;
    }
    (this.elementRef.nativeElement as HTMLElement).blur();

    this.dialog.open(GenericBulkUploadDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: this.config,
      disableClose: false,
      autoFocus: true,
      restoreFocus: true
    });
  }
}
