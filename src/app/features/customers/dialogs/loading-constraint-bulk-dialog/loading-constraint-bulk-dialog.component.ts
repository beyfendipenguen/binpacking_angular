import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { LoadingConstraintService } from '@app/features/services/loading-constraint.service';
import { ToastService } from '@app/core/services/toast.service';
import { CompanyRelation } from '../../../interfaces/company-relation.interface';
import { LoadingConstraint } from '@app/features/interfaces/loading-constraint.interface';

@Component({
  selector: 'app-loading-constraint-bulk-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    TranslateModule,
  ],
  templateUrl: './loading-constraint-bulk-dialog.component.html',
  styleUrl: './loading-constraint-bulk-dialog.component.scss'
})
export class LoadingConstraintBulkDialogComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // State
  isLoading = false;
  isSaving = false;
  currentStep = 1;

  // Step 1 — Pagination & Search (constraint-bulk-dialog ile birebir)
  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  searchControl = new FormControl('');

  // Step 1 — Data
  allRelations: CompanyRelation[] = [];
  selectedRelationIds: string[] = [];
  selectAllMode: 'page' | 'all' = 'page';

  // Step 2 — Data
  allConstraints: LoadingConstraint[] = [];
  selectedConstraintIds: string[] = [];

  constructor(
    private companyRelationService: CompanyRelationService,
    private loadingConstraintService: LoadingConstraintService,
    private toastService: ToastService,
    private translate: TranslateService,
    private dialogRef: MatDialogRef<LoadingConstraintBulkDialogComponent>,
  ) { }

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadRelations();
    // Step 1'deki liste, her relation için ATANMIŞ (varsa) kuralı "Aktif"
    // yerine göstermek istediğinden (bkz. getAssignedConstraint), kurallar
    // artık sadece Step 2'ye geçilince değil, dialog açılır açılmaz da
    // (sessizce, isLoading'i paylaşmadan) yükleniyor — aksi halde iki ayrı
    // yükleme aynı `isLoading` bayrağını yarışarak değiştirip Step 1
    // içeriğinin relations gelmeden önce kısa süreliğine "boş" görünmesine
    // yol açabilirdi.
    this.preloadConstraints();
  }

  /**
   * loadConstraints() ile AYNI veriyi çeker ama isLoading'e dokunmaz ve
   * hata durumunda sessizce geçer — Step 1'in "atanmış kural" gösterimi
   * için bir best-effort ön yükleme. Step 2'ye geçildiğinde loadConstraints()
   * zaten tekrar (isLoading + hata toast'ı ile) çağrılıyor.
   */
  private preloadConstraints(): void {
    this.loadingConstraintService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.allConstraints = page.results;
      },
      error: () => { /* Step 2'de loadConstraints() zaten tekrar deneyecek */ }
    });
  }

  // ─── Step 1: Relation seçimi (constraint-bulk-dialog ile birebir) ───
  private setupSearchDebounce(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage = 0;
        if (this.paginator) this.paginator.pageIndex = 0;
        this.loadRelations();
      });
  }

  private loadRelations(): void {
    this.isLoading = true;
    const params: any = {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
      _skipLoading: true
    };
    const searchTerm = this.searchControl.value?.trim();
    if (searchTerm) params.search = searchTerm;

    this.companyRelationService.getAll(params).subscribe({
      next: (page) => {
        this.allRelations = page.results;
        this.totalItems = page.count;
        this.isLoading = false;
      },
      error: (error) => {
        if (error.status !== 403) {
          this.toastService.error(this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        }
        this.isLoading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadRelations();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  toggleRelation(relationId: string): void {
    const index = this.selectedRelationIds.indexOf(relationId);
    if (index > -1) this.selectedRelationIds.splice(index, 1);
    else this.selectedRelationIds.push(relationId);
  }

  isRelationSelected(relationId: string): boolean {
    return this.selectedRelationIds.includes(relationId);
  }

  selectAll(): void {
    if (this.selectAllMode === 'page') {
      const currentPageIds = this.allRelations.filter(r => r.id).map(r => r.id!);
      const allSelected = currentPageIds.every(id => this.selectedRelationIds.includes(id));
      if (allSelected) {
        this.selectedRelationIds = this.selectedRelationIds.filter(id => !currentPageIds.includes(id));
      } else {
        currentPageIds.forEach(id => {
          if (!this.selectedRelationIds.includes(id)) this.selectedRelationIds.push(id);
        });
      }
    } else {
      this.selectAllRecords();
    }
  }

  private selectAllRecords(): void {
    this.isLoading = true;
    this.companyRelationService.getAll({ limit: 10000 }).subscribe({
      next: (page) => {
        this.selectedRelationIds = page.results.filter(r => r.id).map(r => r.id!);
        this.toastService.success(
          this.translate.instant('CUSTOMER.EXTRA_DATA.ALL_SELECTED', { count: this.selectedRelationIds.length })
        );
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECT_ALL_ERROR'));
        this.isLoading = false;
      }
    });
  }

  clearSelection(): void {
    this.selectedRelationIds = [];
    this.toastService.info(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECTION_CLEARED'));
  }

  /**
   * Bu relation'a şu an ATANMIŞ (aktif) bir yükleme kuralı varsa onu döner —
   * Step 1 listesinde "Aktif" yazısı yerine hangi kuralın uygulandığını
   * göstermek için (bkz. HTML: relation-meta chip). company_relations
   * içinde bu relation'ın id'sini taşıyan İLK kural döner (bir relation'a
   * aynı anda birden fazla FARKLI kural atanamaz, bkz. add_relations
   * override mantığı — LoadingConstraint modeli/backend), yoksa undefined.
   */
  getAssignedConstraint(relation: CompanyRelation): LoadingConstraint | undefined {
    if (!relation.id) return undefined;
    return this.allConstraints.find(c =>
      c.company_relations?.some(r => r.id === relation.id)
    );
  }

  get selectedCount(): number {
    return this.selectedRelationIds.length;
  }

  get isAllSelected(): boolean {
    if (this.allRelations.length === 0) return false;
    const ids = this.allRelations.filter(r => r.id).map(r => r.id!);
    return ids.every(id => this.selectedRelationIds.includes(id));
  }

  get isIndeterminate(): boolean {
    if (this.selectedRelationIds.length === 0) return false;
    const ids = this.allRelations.filter(r => r.id).map(r => r.id!);
    const selectedOnPage = ids.filter(id => this.selectedRelationIds.includes(id)).length;
    return selectedOnPage > 0 && selectedOnPage < ids.length;
  }

  nextStep(): void {
    if (this.selectedRelationIds.length === 0) {
      this.toastService.warning(this.translate.instant('EXTRA_DATA.SELECT_AT_LEAST_ONE'));
      return;
    }
    this.currentStep = 2;
    this.loadConstraints();
  }

  previousStep(): void {
    this.currentStep = 1;
  }

  // ─── Step 2: Kural seçimi ───
  private loadConstraints(): void {
    this.isLoading = true;
    this.loadingConstraintService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.allConstraints = page.results;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error(this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        this.isLoading = false;
      }
    });
  }

  toggleConstraint(constraintId: string): void {
    const constraint = this.allConstraints.find(c => c.id === constraintId);
    if (constraint && this.isConstraintDisabled(constraint)) {
      // Aynı hedefe (type_id + code_id) sahip başka bir kural zaten seçili —
      // tek bir kaydetme işleminde aynı relation'lara çakışan iki kural
      // aynı anda uygulanamaz (bkz. targetKey/isConstraintDisabled).
      this.toastService.warning(this.translate.instant('LOADING_CONSTRAINT.CONFLICTING_RULE_DISABLED'));
      return;
    }
    const index = this.selectedConstraintIds.indexOf(constraintId);
    if (index > -1) this.selectedConstraintIds.splice(index, 1);
    else this.selectedConstraintIds.push(constraintId);
  }

  isConstraintSelected(constraintId: string): boolean {
    return this.selectedConstraintIds.includes(constraintId);
  }

  /**
   * İki kural aynı "hedefe" sahipse (type_id + code_id birebir aynıysa,
   * code_id boşsa sadece type_id aynıysa) aynı anda seçilemezler — aynı
   * relation'da aynı hedef için sadece tek bir kural aktif olabilir.
   */
  private targetKey(c: LoadingConstraint): string {
    return `${c.type_id}::${c.code_id ?? ''}`;
  }

  isConstraintDisabled(constraint: LoadingConstraint): boolean {
    if (this.isConstraintSelected(constraint.id!)) return false;
    const key = this.targetKey(constraint);
    return this.selectedConstraintIds.some(id => {
      const other = this.allConstraints.find(c => c.id === id);
      return !!other && this.targetKey(other) === key;
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

  // ─── Save ───
  onSave(): void {
    if (this.selectedConstraintIds.length === 0) {
      this.toastService.warning(this.translate.instant('LOADING_CONSTRAINT.SELECT_AT_LEAST_ONE_RULE'));
      return;
    }

    this.isSaving = true;

    const requests = this.selectedConstraintIds.map(constraintId =>
      this.loadingConstraintService.addRelations(constraintId, this.selectedRelationIds).pipe(
        catchError(error => of({ __error: error }))
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        // Tip guard: filter'a düz (r: any) verilirse dönen dizinin elemanı
        // hâlâ LoadingConstraint | {__error} union'ı olarak kalır ve
        // failed[0].__error erişimi TS2339 hatası verir. `r is {...}`
        // predicate'i failed dizisinin tipini gerçekten daraltır.
        const failed = results.filter(
          (r): r is { __error: any } => !!(r as { __error?: any }).__error
        );
        this.isSaving = false;

        if (failed.length === 0) {
          this.toastService.success(this.translate.instant('LOADING_CONSTRAINT.APPLY_SUCCESS'));
          this.dialogRef.close(true);
        } else if (failed.length < results.length) {
          this.toastService.warning(this.translate.instant('LOADING_CONSTRAINT.APPLY_PARTIAL', { failed: failed.length }));
          this.dialogRef.close(true);
        } else {
          const errorMsg = getApiErrorMessage(failed[0].__error, this.translate.instant('COMMON.SAVE_ERROR'));
          this.toastService.error(errorMsg);
        }
      },
      error: (error) => {
        const errorMsg = getApiErrorMessage(error, this.translate.instant('COMMON.SAVE_ERROR'));
        this.toastService.error(errorMsg);
        this.isSaving = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
