import { Component, OnInit, ViewChild, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { ToastService } from '@app/core/services/toast.service';
import { CompanyRelation } from '../../../interfaces/company-relation.interface';
import { ConstraintProfile } from '@app/features/interfaces/constraint-profile.interface';
import { ConstraintFormComponent } from '../../components/constraint-form/constraint-form.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-constraint-bulk-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatPaginatorModule,
    TranslateModule,
    ConstraintFormComponent,
  ],
  templateUrl: './constraint-bulk-dialog.component.html',
  styleUrl: './constraint-bulk-dialog.component.scss'
})
export class ConstraintBulkDialogComponent implements OnInit, OnDestroy {
  private companyRelationService = inject(CompanyRelationService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private dialogRef = inject(MatDialogRef<ConstraintBulkDialogComponent>);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // State
  isLoading = false;
  isSaving = false;
  currentStep = 1;

  // Pagination & Search
  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  searchControl = new FormControl('');

  private destroy$ = new Subject<void>();

  // Data
  allRelations: CompanyRelation[] = [];
  selectedRelationIds: string[] = [];
  selectAllMode: 'page' | 'all' = 'page';

  // Ortak kısıt formu
  @ViewChild(ConstraintFormComponent) constraintForm?: ConstraintFormComponent;
  /** Tam 1 ilişki seçiliyse onun mevcut profili (form buna göre dolar); aksi halde null. */
  formProfile: Partial<ConstraintProfile> | null = null;

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadRelations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Search debounce (extra-data dialog ile birebir) ───
  private setupSearchDebounce(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 0;
        if (this.paginator) this.paginator.pageIndex = 0;
        this.loadRelations();
      });
  }

  // ─── Relation load (extra-data dialog ile birebir) ───
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

  // ─── Selection (extra-data dialog ile birebir) ───
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

    // Tek ilişki seçildiyse mevcut profilini göster; çoklu seçimde form boş başlar.
    this.formProfile = null;
    if (this.selectedRelationIds.length === 1) {
      const rel = this.allRelations.find(r => r.id === this.selectedRelationIds[0]);
      this.formProfile = (rel?.constraint_profile as Partial<ConstraintProfile> | undefined) ?? null;
    }

    this.currentStep = 2;
  }

  previousStep(): void {
    this.currentStep = 1;
  }

  // ─── Save ───
  onSave(): void {
    if (this.selectedRelationIds.length === 0) {
      this.toastService.warning(this.translate.instant('CUSTOMER.EXTRA_DATA.SELECT_AT_LEAST_ONE'));
      return;
    }

    const form = this.constraintForm;
    if (!form) return;

    if (!form.valid) {
      form.markAllAsTouched();
      this.toastService.error(this.translate.instant('CUSTOMER.FILL_ALL_FIELDS'));
      return;
    }

    // Sadece DEĞİŞTİRİLEN alanlar gönderilir; dokunulmayan hiçbir alan ezilmez.
    const constraintUpdates = form.getChanges();
    if (Object.keys(constraintUpdates).length === 0) {
      this.toastService.warning(this.translate.instant('CONSTRAINT.BULK.NO_CHANGES'));
      return;
    }

    this.isSaving = true;
    this.companyRelationService.bulkUpdateConstraintProfile(
      this.selectedRelationIds,
      constraintUpdates
    ).subscribe({
      next: (result) => {
        this.toastService.success(
          this.translate.instant('CONSTRAINT.BULK.UPDATE_SUCCESS', { count: result.updated_count })
        );
        this.dialogRef.close(true);
      },
      error: (error) => {
        const errorMsg = getApiErrorMessage(
          error, this.translate.instant('CONSTRAINT.BULK.UPDATE_ERROR')
        );
        this.toastService.error(errorMsg);
        this.isSaving = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
