import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastService } from '@app/core/services/toast.service';
import { getApiErrorMessage } from '@app/core/utils/api-error.util';
import { PalletSelectionRuleService } from '@app/features/services/pallet-selection-rule.service';
import { PalletGroupService } from '@app/features/services/pallet-group.service';
import { PalletSelectionRule } from '@app/features/interfaces/pallet-selection-rule.interface';
import { PalletGroup } from '@app/features/interfaces/pallet-group.interface';
import { ConfirmDialogComponent } from '@app/shared/generic-table/confirm-dialog/confirm-dialog.component';

/**
 * Ürünün width/depth aralığına göre palet aramasını belirli bir PalletGroup
 * içine daraltan kuralları company seviyesinde tanımlamak için dialog.
 *
 * LoadingConstraintDialogComponent ile AYNI desende: form + "mevcut
 * kurallar" listesi tek dialogda, dialog kapanmadan arka arkaya kural
 * tanımlanabilir/düzenlenebilir. Hangi relation'larda aktif olduğu ayrı bir
 * bulk-dialog'da (PalletSelectionRuleBulkDialogComponent) yönetilir.
 */
@Component({
  selector: 'app-pallet-selection-rule-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './pallet-selection-rule-dialog.component.html',
  styleUrl: './pallet-selection-rule-dialog.component.scss',
})
export class PalletSelectionRuleDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private ruleService = inject(PalletSelectionRuleService);
  private palletGroupService = inject(PalletGroupService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<PalletSelectionRuleDialogComponent>);

  isSaving = signal(false);
  isLoadingList = signal(false);
  isLoadingGroups = signal(false);

  form!: FormGroup;
  palletGroups: PalletGroup[] = [];
  rules: PalletSelectionRule[] = [];
  editingId: string | null = null;

  ngOnInit(): void {
    this.form = this.fb.group({
      width_min: [null, [Validators.required, Validators.min(0)]],
      width_max: [null, [Validators.required, Validators.min(0)]],
      depth_min: [null, [Validators.required, Validators.min(0)]],
      depth_max: [null, [Validators.required, Validators.min(0)]],
      pallet_group: [null, [Validators.required]],
    });

    this.loadPalletGroups();
    this.loadRules();
  }

  private loadPalletGroups(): void {
    this.isLoadingGroups.set(true);
    this.palletGroupService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.palletGroups = page.results;
        this.isLoadingGroups.set(false);
      },
      error: () => {
        this.palletGroups = [];
        this.isLoadingGroups.set(false);
      },
    });
  }

  private loadRules(): void {
    this.isLoadingList.set(true);
    this.ruleService.getAll({ limit: 200 }).subscribe({
      next: (page) => {
        this.rules = page.results;
        this.isLoadingList.set(false);
      },
      error: (error) => {
        this.rules = [];
        this.isLoadingList.set(false);
        const errorMsg = getApiErrorMessage(error, this.translate.instant('COMMON.DATA_LOAD_ERROR'));
        this.toastService.error(errorMsg);
      },
    });
  }

  palletGroupName(id: string): string {
    return this.palletGroups.find((g) => g.id === id)?.name || id;
  }

  ruleLabel(rule: PalletSelectionRule): string {
    const groupName = rule.pallet_group_name || this.palletGroupName(rule.pallet_group);
    return `w[${rule.width_min}-${rule.width_max}] d[${rule.depth_min}-${rule.depth_max}] → ${groupName}`;
  }

  /**
   * Formdaki mevcut aralığın, zaten kayıtlı kurallardan biriyle kesişip
   * kesişmediğini hesaplar — SADECE bilgilendirme amaçlı, kaydı ENGELLEMEZ.
   * Backend de reddetmiyor (bkz. PalletSelectionRuleWriteSerializer
   * docstring'i): çakışan kurallar bilinçli bir tasarım kararıyla birlikte
   * aktif kalabilir, calculate_package_service ikisinin pallet_group'unu
   * birleştirip (union) arar.
   */
  get overlappingRules(): PalletSelectionRule[] {
    const { width_min, width_max, depth_min, depth_max } = this.form.value;
    if ([width_min, width_max, depth_min, depth_max].some((v) => v === null || v === undefined || v === '')) {
      return [];
    }
    const wMin = Number(width_min);
    const wMax = Number(width_max);
    const dMin = Number(depth_min);
    const dMax = Number(depth_max);
    if (Number.isNaN(wMin) || Number.isNaN(wMax) || Number.isNaN(dMin) || Number.isNaN(dMax)) {
      return [];
    }
    if (wMin > wMax || dMin > dMax) return [];

    return this.rules.filter((r) => {
      if (this.editingId && r.id === this.editingId) return false;
      const widthOverlap = wMin <= Number(r.width_max) && Number(r.width_min) <= wMax;
      const depthOverlap = dMin <= Number(r.depth_max) && Number(r.depth_min) <= dMax;
      return widthOverlap && depthOverlap;
    });
  }

  startEdit(rule: PalletSelectionRule): void {
    this.editingId = rule.id;
    this.form.patchValue({
      width_min: rule.width_min,
      width_max: rule.width_max,
      depth_min: rule.depth_min,
      depth_max: rule.depth_max,
      pallet_group: rule.pallet_group,
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form.reset();
  }

  deleteRule(rule: PalletSelectionRule): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: `"${this.ruleLabel(rule)}" ${this.translate.instant('PALLET_SELECTION_RULE.DELETE_CONFIRM')}`,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed || !rule.id) return;

      this.ruleService.delete(rule.id).subscribe({
        next: () => {
          this.toastService.success(this.translate.instant('PALLET_SELECTION_RULE.DELETED'));
          if (this.editingId === rule.id) this.cancelEdit();
          this.loadRules();
        },
        error: (error) => {
          const errorMsg = getApiErrorMessage(error, this.translate.instant('COMMON.SAVE_ERROR'));
          this.toastService.error(errorMsg);
        },
      });
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { width_min, width_max, depth_min, depth_max, pallet_group } = this.form.value;

    if (Number(width_min) > Number(width_max)) {
      this.toastService.warning(this.translate.instant('PALLET_SELECTION_RULE.WIDTH_RANGE_INVALID'));
      return;
    }
    if (Number(depth_min) > Number(depth_max)) {
      this.toastService.warning(this.translate.instant('PALLET_SELECTION_RULE.DEPTH_RANGE_INVALID'));
      return;
    }

    const payload = { width_min, width_max, depth_min, depth_max, pallet_group };

    this.isSaving.set(true);

    const request$ = this.editingId
      ? this.ruleService.update(this.editingId, payload)
      : this.ruleService.create(payload);

    request$.subscribe({
      next: () => {
        this.toastService.success(this.translate.instant('COMMON.SUCCESS'));
        this.isSaving.set(false);
        this.editingId = null;
        this.form.reset();
        this.loadRules();
        // Dialog kapanmaz — kullanıcı listeyi görüp arka arkaya kural
        // tanımlayabilsin/düzenleyebilsin diye (LoadingConstraint ile aynı).
      },
      error: (error) => {
        const errorMsg = getApiErrorMessage(error, this.translate.instant('COMMON.SAVE_ERROR'));
        this.toastService.error(errorMsg);
        this.isSaving.set(false);
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(this.rules.length > 0);
  }
}
