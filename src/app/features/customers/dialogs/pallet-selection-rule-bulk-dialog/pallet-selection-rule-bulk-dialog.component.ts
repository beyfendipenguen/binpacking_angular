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
import { PalletSelectionRuleService } from '@app/features/services/pallet-selection-rule.service';
import { ToastService } from '@app/core/services/toast.service';
import { CompanyRelation } from '../../../interfaces/company-relation.interface';
import { PalletSelectionRule } from '@app/features/interfaces/pallet-selection-rule.interface';

/**
 * LoadingConstraintBulkDialogComponent ile AYNI desende (2 adım: relation
 * seçimi → kural seçimi), TEK farkla: burada iki kural aynı relation'da
 * aynı anda aktif kalabilir (bkz. PalletSelectionRule model docstring'i —
 * çakışan aralıklar reddedilmez, union aranır), bu yüzden LoadingConstraint
 * bulk-dialog'undaki "çakışan kuralın checkbox'ını disable et" mantığı
 * BURADA YOK — Step 2'de kurallar sadece serbest çoklu seçim.
 */
@Component({
  selector: 'app-pallet-selection-rule-bulk-dialog',
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
  templateUrl: './pallet-selection-rule-bulk-dialog.component.html',
  styleUrl: './pallet-selection-rule-bulk-dialog.component.scss'
})
export class PalletSelectionRuleBulkDialogComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // State
  isLoading = false;
  isSaving = false;
  currentStep = 1;

  // Step 1 — Pagination & Search
  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  searchControl = new FormControl('');

  // Step 1 — Data
  allRelations: CompanyRelation[] = [];
  selectedRelationIds: string[] = [];
  selectAllMode: 'page' | 'all' = 'page';

  // Step 2 — Data
  allRules: PalletSelectionRule[] = [];
  selectedRuleIds: string[] = [];

  constructor(
    private companyRelationService: CompanyRelationService,
    private ruleService: PalletSelectionRuleService,
    private toastService: ToastService,
    private translate: TranslateService,
    private dialogRef: MatDialogRef<PalletSelectionRuleBulkDialogComponent>,
  ) { }

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadRelations();
    // Step 1'deki liste, her relation için atanmış kuralların SAYISINI
    // göstermek istediğinden (bkz. getAssignedRules), kurallar dialog
    // açılır açılmaz da (sessizce, isLoading'i paylaşmadan) yükleniyor.
    this.preloadRules();
  }

  private preloadRules(): void {
    this.ruleService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.allRules = page.results;
      },
      error: () => { /* Step 2'de loadRules() zaten tekrar deneyecek */ }
    });
  }

  // ─── Step 1: Relation seçimi ───
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
   * Bu relation'a şu an ATANMIŞ (aktif) kuralları döner — LoadingConstraint'in
   * aksine BİRDEN FAZLA olabilir (bkz. component docstring'i), bu yüzden tek
   * bir kural yerine bir liste döner.
   */
  getAssignedRules(relation: CompanyRelation): PalletSelectionRule[] {
    if (!relation.id) return [];
    return this.allRules.filter(r =>
      r.company_relations?.some(cr => cr.id === relation.id)
    );
  }

  /**
   * Bu relation'a atanmış kuralların etiketlerini (bkz. ruleLabel) satır
   * satır birleştirir — status-rule-assigned chip'inin tooltip'inde sadece
   * sayıyı değil, hangi kuralların atandığını göstermek için.
   */
  assignedRulesTooltip(relation: CompanyRelation): string {
    return this.getAssignedRules(relation).map(r => this.ruleLabel(r)).join('\n');
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
    this.loadRules();
  }

  previousStep(): void {
    this.currentStep = 1;
  }

  // ─── Step 2: Kural seçimi (serbest çoklu seçim, disable YOK) ───
  private loadRules(): void {
    this.isLoading = true;
    this.ruleService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.allRules = page.results;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.error(this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        this.isLoading = false;
      }
    });
  }

  toggleRule(ruleId: string): void {
    const index = this.selectedRuleIds.indexOf(ruleId);
    if (index > -1) this.selectedRuleIds.splice(index, 1);
    else this.selectedRuleIds.push(ruleId);
  }

  isRuleSelected(ruleId: string): boolean {
    return this.selectedRuleIds.includes(ruleId);
  }

  ruleLabel(rule: PalletSelectionRule): string {
    const groupName = rule.pallet_group_name || rule.pallet_group;
    return `w[${rule.width_min}-${rule.width_max}] d[${rule.depth_min}-${rule.depth_max}] → ${groupName}`;
  }

  // ─── Save ───
  onSave(): void {
    if (this.selectedRuleIds.length === 0) {
      this.toastService.warning(this.translate.instant('PALLET_SELECTION_RULE.SELECT_AT_LEAST_ONE_RULE'));
      return;
    }

    this.isSaving = true;

    const requests = this.selectedRuleIds.map(ruleId =>
      this.ruleService.addRelations(ruleId, this.selectedRelationIds).pipe(
        catchError(error => of({ __error: error }))
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const failed = results.filter(
          (r): r is { __error: any } => !!(r as { __error?: any }).__error
        );
        this.isSaving = false;

        if (failed.length === 0) {
          this.toastService.success(this.translate.instant('PALLET_SELECTION_RULE.APPLY_SUCCESS'));
          this.dialogRef.close(true);
        } else if (failed.length < results.length) {
          this.toastService.warning(this.translate.instant('PALLET_SELECTION_RULE.APPLY_PARTIAL', { failed: failed.length }));
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
