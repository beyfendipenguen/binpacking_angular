import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/** Mesajdaki görseli uygulama içinde (yeni sekme açmadan) büyük önizleme olarak gösterir. */
@Component({
  selector: 'app-image-preview-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="ip" (click)="close()">
      <div class="ip__bar" (click)="$event.stopPropagation()">
        <a mat-icon-button [href]="data.url" download target="_blank" rel="noopener" aria-label="download">
          <mat-icon>download</mat-icon>
        </a>
        <button mat-icon-button (click)="close()" aria-label="close"><mat-icon>close</mat-icon></button>
      </div>
      <img class="ip__img" [src]="data.url" alt="" (click)="$event.stopPropagation()" />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ip { position: relative; display: flex; align-items: center; justify-content: center; min-width: 200px; min-height: 200px; max-width: 92vw; max-height: 90vh; cursor: zoom-out; }
    .ip__img { max-width: 92vw; max-height: 90vh; object-fit: contain; border-radius: 6px; cursor: default; display: block; }
    .ip__bar { position: absolute; top: 6px; right: 6px; z-index: 1; display: flex; gap: 2px; background: rgba(0,0,0,.55); border-radius: 999px; }
    .ip__bar a, .ip__bar button { color: #fff; }
  `],
})
export class ImagePreviewDialogComponent {
  readonly data = inject<{ url: string }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ImagePreviewDialogComponent>);
  close(): void { this.ref.close(); }
}
