import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize, takeUntil } from 'rxjs/operators';
import { ToastService } from '@app/core/services/toast.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { ProductTypeService } from '@app/features/services/product-type.service';
import { LoadingConstraintService } from '@app/features/services/loading-constraint.service';
import { ProductType } from '@app/features/interfaces/product-type.interface';
import { LoadingConstraint } from '@app/features/interfaces/loading-constraint.interface';
import { ConfirmDialogComponent } from '@app/shared/generic-table/confirm-dialog/confirm-dialog.component';

/**
 * Code seçimi de aynı ProductType satırından geliyor (backend'de ayrı bir
 * model yok), ama type seçimiyle KARIŞTIRILMAMASI için ayrı bir isimle
 * kullanıyoruz — filteredCodes/selectedCode her zaman "belirli bir type'a
 * ait code satırı" anlamına gelir, filteredTypes/selectedType ise "temsilci
 * type satırı" anlamına gelir.
 */
type ProductCode = ProductType;

@Component({
  selector: 'app-loading-constraint-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './loading-constraint-dialog.component.html',
  styleUrl: './loading-constraint-dialog.component.scss',
})
export class LoadingConstraintDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private productTypeService = inject(ProductTypeService);
  private loadingConstraintService = inject(LoadingConstraintService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<LoadingConstraintDialogComponent>);

  private destroy$ = new Subject<void>();

  isSaving = signal(false);
  isLoadingList = signal(false);

  form!: FormGroup;
  typeSearchControl = new FormControl('');
  codeSearchControl = new FormControl({ value: '', disabled: true });

  filteredTypes: ProductType[] = [];
  filteredCodes: ProductCode[] = [];
  isSearchingTypes = false;
  isSearchingCodes = false;

  selectedType: ProductType | null = null;
  selectedCode: ProductCode | null = null;

  // Mevcut kurallar listesi + düzenleme durumu
  constraints: LoadingConstraint[] = [];
  editingId: string | null = null;

  ngOnInit(): void {
    this.form = this.fb.group({
      first_layer_count: [null, [Validators.required, Validators.min(1)]],
      second_layer_count: [null, [Validators.min(1)]],
    });

    this.setupTypeAutocomplete();
    this.setupCodeAutocomplete();
    this.loadConstraints();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Type araması (icontains, serbest arama) ───
  private setupTypeAutocomplete(): void {
    this.typeSearchControl.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((value) => {
          if (typeof value !== 'string' || value.trim().length === 0) {
            this.filteredTypes = [];
            // NOT: of([]) DEĞİL — aşağıdaki ProductType dalıyla aynı tip
            // (BaseResponse<ProductType> | null) dönmezse switchMap'in
            // birleşik tipi never[] | BaseResponse<ProductType> | null
            // olur ve page.results erişimi TS2339 hatası verir.
            return of(null);
          }
          this.isSearchingTypes = true;
          return this.productTypeService.getAll({ type: value.trim(), limit: 20 }).pipe(
            catchError(() => of(null)),
            finalize(() => { this.isSearchingTypes = false; })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        if (!page) {
          this.filteredTypes = [];
          return;
        }
        // Aynı "type" değeri birden fazla code ile birden fazla satırda
        // gelebilir — dropdown'da her type'ı bir kez göster (temsilci satır).
        const seen = new Set<string>();
        this.filteredTypes = page.results.filter((row: ProductType) => {
          if (seen.has(row.type)) return false;
          seen.add(row.type);
          return true;
        }).slice(0, 5);
      });
  }

  displayTypeFn(row: ProductType): string {
    return row?.type || '';
  }

  onTypeSelected(row: ProductType): void {
    this.selectedType = row;
    this.selectedCode = null;
    this.codeSearchControl.setValue('', { emitEvent: false });
    this.codeSearchControl.enable({ emitEvent: false });

    this.isSearchingCodes = true;
    this.loadCodesForType('').subscribe((page) => {
      this.applyCodeResults(page);
      this.isSearchingCodes = false;
    });
  }

  clearType(): void {
    this.selectedType = null;
    this.selectedCode = null;
    this.typeSearchControl.setValue('');
    this.codeSearchControl.setValue('', { emitEvent: false });
    this.codeSearchControl.disable({ emitEvent: false });
    this.filteredCodes = [];
  }

  // ─── Code araması (seçili type'a göre cascade, iexact type_exact) ───
  private setupCodeAutocomplete(): void {
    this.codeSearchControl.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((value) => {
          if (!this.selectedType) return of(null);
          // mat-option seçilince matAutocomplete, formControl'ün değerini
          // display string'e değil SEÇİLEN TÜM SATIR OBJESİNE set eder
          // (bkz. onCodeSelected). O durumda value bir ProductCode objesi
          // olur, string değil — arama tetiklenmemeli (seçim zaten
          // onCodeSelected'da işleniyor), aksi halde search.trim()
          // objede patlar.
          if (typeof value !== 'string') return of(null);
          this.isSearchingCodes = true;
          return this.loadCodesForType(value);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        this.applyCodeResults(page);
        this.isSearchingCodes = false;
      });
  }

  private loadCodesForType(search: string) {
    if (!this.selectedType) return of(null);
    const trimmed = typeof search === 'string' ? search.trim() : '';
    const params: any = { type_exact: this.selectedType.type, limit: 5 };
    if (trimmed) params.code = trimmed;

    return this.productTypeService.getAll(params).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * filteredCodes'u set etmeden önce, gelen satırların GERÇEKTEN seçili
   * type'a ait olduğunu ikinci kez (client-side) doğrular. Backend zaten
   * type_exact ile filtreliyor ama bu ekstra güvenlik: kullanıcı asla
   * seçili type'a ait olmayan bir code'u görüp seçemesin.
   */
  private applyCodeResults(page: { results: ProductCode[] } | null): void {
    if (!page || !this.selectedType) {
      this.filteredCodes = [];
      return;
    }
    const typeValue = this.selectedType.type;
    this.filteredCodes = page.results.filter(
      (row) => row.type?.toLowerCase() === typeValue?.toLowerCase()
    );
  }

  displayCodeFn(row: ProductCode): string {
    return row?.code || '';
  }

  onCodeSelected(row: ProductCode): void {
    if (!this.selectedType || row.type?.toLowerCase() !== this.selectedType.type?.toLowerCase()) {
      // Güvenlik ağı: buraya normalde hiç düşülmemeli (filteredCodes zaten
      // type'a göre filtreli), ama düşerse seçimi reddet.
      this.toastService.error(this.translate.instant('LOADING_CONSTRAINT.CODE_TYPE_MISMATCH'));
      this.clearCode();
      return;
    }
    this.selectedCode = row;
  }

  clearCode(): void {
    this.selectedCode = null;
    this.codeSearchControl.setValue('');
  }

  // ─── Mevcut kurallar listesi ───
  private loadConstraints(): void {
    this.isLoadingList.set(true);
    this.loadingConstraintService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.constraints = page.results;
        this.isLoadingList.set(false);
      },
      error: () => {
        this.isLoadingList.set(false);
      },
    });
  }

  constraintLabel(constraint: LoadingConstraint): string {
    const typePart = constraint.type ?? constraint.type_id;
    const codePart = constraint.code ? ` / ${constraint.code}` : '';
    const layers = constraint.second_layer_count
      ? `${constraint.first_layer_count} + ${constraint.second_layer_count}`
      : `${constraint.first_layer_count}`;
    return `${typePart}${codePart} — ${layers}`;
  }

  startEdit(constraint: LoadingConstraint): void {
    this.editingId = constraint.id;

    // Liste satırında zaten çözülmüş type/code string'i var (backend
    // SerializerMethodField) — ayrı bir API çağrısı yapmadan, bu bilgiyle
    // sahte-ama-yeterli ProductType satırları kurup formu dolduruyoruz.
    this.selectedType = { id: constraint.type_id, type: constraint.type || '', code: '' } as ProductType;
    this.typeSearchControl.setValue(constraint.type || '', { emitEvent: false });

    if (constraint.code_id) {
      this.selectedCode = { id: constraint.code_id, type: constraint.type || '', code: constraint.code || '' } as ProductCode;
      this.codeSearchControl.setValue(constraint.code || '', { emitEvent: false });
      this.codeSearchControl.enable({ emitEvent: false });
    } else {
      this.selectedCode = null;
      this.codeSearchControl.setValue('', { emitEvent: false });
      this.codeSearchControl.enable({ emitEvent: false });
    }

    this.form.patchValue({
      first_layer_count: constraint.first_layer_count,
      second_layer_count: constraint.second_layer_count ?? null,
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.resetForm();
  }

  private resetForm(): void {
    this.selectedType = null;
    this.selectedCode = null;
    this.typeSearchControl.setValue('', { emitEvent: false });
    this.codeSearchControl.setValue('', { emitEvent: false });
    this.codeSearchControl.disable({ emitEvent: false });
    this.filteredTypes = [];
    this.filteredCodes = [];
    this.form.reset();
  }

  deleteConstraint(constraint: LoadingConstraint): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: `"${this.constraintLabel(constraint)}" ${this.translate.instant('LOADING_CONSTRAINT.DELETE_CONFIRM')}`,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed || !constraint.id) return;

      this.loadingConstraintService.delete(constraint.id).subscribe({
        next: () => {
          this.toastService.success(this.translate.instant('LOADING_CONSTRAINT.DELETED'));
          if (this.editingId === constraint.id) this.cancelEdit();
          this.loadConstraints();
        },
        error: (error) => {
          const errorMsg = getApiErrorMessage(error, this.translate.instant('COMMON.SAVE_ERROR'));
          this.toastService.error(errorMsg);
        },
      });
    });
  }

  onSave(): void {
    if (!this.selectedType) {
      this.toastService.warning(this.translate.instant('LOADING_CONSTRAINT.SELECT_TYPE_FIRST'));
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { first_layer_count, second_layer_count } = this.form.value;

    const payload = {
      type_id: this.selectedType.id,
      code_id: this.selectedCode?.id ?? null,
      first_layer_count,
      second_layer_count: second_layer_count || null,
    };

    this.isSaving.set(true);

    const request$ = this.editingId
      ? this.loadingConstraintService.update(this.editingId, payload)
      : this.loadingConstraintService.create(payload);

    request$.subscribe({
      next: () => {
        this.toastService.success(this.translate.instant('COMMON.SUCCESS'));
        this.isSaving.set(false);
        this.editingId = null;
        this.resetForm();
        this.loadConstraints();
        // Dialog kapanmaz — kullanıcı listeyi görüp arka arkaya kural
        // tanımlayabilsin/düzenleyebilsin diye.
      },
      error: (error) => {
        const errorMsg = getApiErrorMessage(error, this.translate.instant('COMMON.SAVE_ERROR'));
        this.toastService.error(errorMsg);
        this.isSaving.set(false);
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(this.constraints.length > 0);
  }
}
