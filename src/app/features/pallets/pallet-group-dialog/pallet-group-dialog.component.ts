import { Component, inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { PalletGroup } from '@app/features/interfaces/pallet-group.interface';
import { Pallet } from '@app/features/interfaces/pallet.interface';
import { PalletGroupService } from '@app/features/services/pallet-group.service';
import { PalletService } from '@app/features/services/pallet.service';
import { ToastService } from '@app/core/services/toast.service';

@Component({
  selector: 'app-pallet-group-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule,
    MatChipsModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './pallet-group-dialog.component.html',
  styleUrls: ['./pallet-group-dialog.component.scss']
})
export class PalletGroupDialogComponent implements OnInit {

  private translate = inject(TranslateService);
  // Servisler
  private palletGroupService = inject(PalletGroupService);
  private palletService = inject(PalletService);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private dialogRef = inject(MatDialogRef<PalletGroupDialogComponent>);

  // Veriler
  groups: PalletGroup[] = [];
  allPallets: Pallet[] = [];
  selectedGroup: PalletGroup | null = null;
  isNewGroup = false;

  // Form
  groupForm: FormGroup;

  // Loading durumları
  isLoadingGroups = false;
  isLoadingPallets = false;
  isSaving = false;

  // Seçili paletler (ID'ler)
  selectedPalletIds: Set<string> = new Set();

  // Transfer için geçici seçimler
  tempSelectedAvailable: Set<string> = new Set();
  tempSelectedInGroup: Set<string> = new Set();

  // Arama kontrolleri
  searchAvailableControl = new FormControl('');
  searchSelectedControl = new FormControl('');

  constructor() {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      is_global: [false]
    });
  }

  ngOnInit(): void {
    this.loadGroups();
    this.loadAllPallets();
  }

  // Mevcut (gruba eklenmemiş) paletler
  get availablePallets(): Pallet[] {
    const searchTerm = this.searchAvailableControl.value?.toLowerCase() || '';

    return this.allPallets
      .filter(p => !this.selectedPalletIds.has(p.id))
      .filter(p => {
        if (!searchTerm) return true;

        const dimensions = `${p.dimension.width}x${p.dimension.depth}x${p.dimension.height}`;
        const weight = p.weight.toString();

        return dimensions.toLowerCase().includes(searchTerm) ||
          weight.includes(searchTerm);
      });
  }

  // Gruba eklenmiş paletler
  get selectedPallets(): Pallet[] {
    const searchTerm = this.searchSelectedControl.value?.toLowerCase() || '';

    return this.allPallets
      .filter(p => this.selectedPalletIds.has(p.id))
      .filter(p => {
        if (!searchTerm) return true;

        const dimensions = `${p.dimension.width}x${p.dimension.depth}x${p.dimension.height}`;
        const weight = p.weight.toString();

        return dimensions.toLowerCase().includes(searchTerm) ||
          weight.includes(searchTerm);
      });
  }

  /**
  * Seçili listede arama temizle
  */
  clearSelectedSearch(): void {
    this.searchSelectedControl.setValue('');
  }

  /**
  * Mevcut listede arama temizle
  */
  clearAvailableSearch(): void {
    this.searchAvailableControl.setValue('');
  }

  // Seçili grubun global olup olmadığını kontrol et
  isGlobalGroup(): boolean {
    return this.selectedGroup?.is_global === true;
  }

  // Düzenleme yapılabilir mi kontrolü
  canEditGroup(): boolean {
    return !this.isGlobalGroup();
  }

  /**
  * Mevcut listeden seçim toggle
  */
  toggleAvailableSelection(palletId: string): void {
    if (this.isGlobalGroup()) return;

    if (this.tempSelectedAvailable.has(palletId)) {
      this.tempSelectedAvailable.delete(palletId);
    } else {
      this.tempSelectedAvailable.add(palletId);
    }
  }

  /**
   * Seçili listeden seçim toggle
   */
  toggleSelectedSelection(palletId: string): void {
    if (this.isGlobalGroup()) return;

    if (this.tempSelectedInGroup.has(palletId)) {
      this.tempSelectedInGroup.delete(palletId);
    } else {
      this.tempSelectedInGroup.add(palletId);
    }
  }

  /**
   * Seçili paletleri gruba ekle
   */
  addSelectedToGroup(): void {
    if (this.isGlobalGroup()) return;

    this.tempSelectedAvailable.forEach(id => {
      this.selectedPalletIds.add(id);
    });
    this.tempSelectedAvailable.clear();
  }

  /**
   * Seçili paletleri gruptan çıkar
   */
  removeSelectedFromGroup(): void {
    if (this.isGlobalGroup()) return;

    this.tempSelectedInGroup.forEach(id => {
      this.selectedPalletIds.delete(id);
    });
    this.tempSelectedInGroup.clear();
  }

  /**
   * Tüm mevcut paletleri gruba ekle
   */
  addAllToGroup(): void {
    if (this.isGlobalGroup()) return;

    this.availablePallets.forEach(p => {
      this.selectedPalletIds.add(p.id);
    });
    this.tempSelectedAvailable.clear();
  }

  /**
   * Tüm paletleri gruptan çıkar
   */
  removeAllFromGroup(): void {
    if (this.isGlobalGroup()) return;

    this.selectedPalletIds.clear();
    this.tempSelectedInGroup.clear();
  }

  /**
   * Tek palet ekle (çift tıklama için)
   */
  addSinglePallet(palletId: string): void {
    if (this.isGlobalGroup()) return;
    this.selectedPalletIds.add(palletId);
  }

  /**
   * Tek palet çıkar (çift tıklama için)
   */
  removeSinglePallet(palletId: string): void {
    if (this.isGlobalGroup()) return;
    this.selectedPalletIds.delete(palletId);
  }

  /**
   * Grup seç - güncellenmiş
   */
  selectGroup(group: PalletGroup): void {
    this.selectedGroup = group;
    this.isNewGroup = false;

    this.groupForm.patchValue({
      name: group.name,
      description: group.description || '',
      is_global: group.is_global
    });

    if (group.is_global) {
      this.groupForm.disable();
    } else {
      this.groupForm.enable();
    }

    this.selectedPalletIds = new Set(group.pallets.map(p => p.id));

    // Geçici seçimleri ve aramaları temizle
    this.tempSelectedAvailable.clear();
    this.tempSelectedInGroup.clear();
    this.searchAvailableControl.setValue('');
    this.searchSelectedControl.setValue('');
  }

  /**
   * Yeni grup oluştur - güncellenmiş
   */
  createNewGroup(): void {
    this.selectedGroup = null;
    this.isNewGroup = true;
    this.groupForm.enable();
    this.groupForm.reset({
      name: '',
      description: '',
      is_global: false
    });
    this.selectedPalletIds.clear();
    this.tempSelectedAvailable.clear();
    this.tempSelectedInGroup.clear();
    this.searchAvailableControl.setValue('');
    this.searchSelectedControl.setValue('');
  }

  /**
   * Tüm grupları yükle
   */
  loadGroups(): void {
    this.isLoadingGroups = true;
    this.palletGroupService.getAll().subscribe({
      next: (response) => {
        this.groups = response.results;
        this.isLoadingGroups = false;
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('PALLET_MESSAGES.GROUPS_LOAD_ERROR'));
        this.isLoadingGroups = false;
      }
    });
  }

  /**
   * Tüm paletleri yükle
   */
  loadAllPallets(): void {
    this.isLoadingPallets = true;
    this.palletService.getAll({ limit: 100 }).subscribe({
      next: (response) => {
        this.allPallets = response.results;
        this.isLoadingPallets = false;
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('PALLET_MESSAGES.PALLETS_LOAD_ERROR'));
        this.isLoadingPallets = false;
      }
    });
  }

  /**
   * Palet seçimini toggle et
   */
  togglePalletSelection(palletId: string): void {
    // Global grup ise palet seçimine izin verme
    if (this.isGlobalGroup()) {
      return;
    }

    if (this.selectedPalletIds.has(palletId)) {
      this.selectedPalletIds.delete(palletId);
    } else {
      this.selectedPalletIds.add(palletId);
    }
  }

  /**
   * Paletin seçili olup olmadığını kontrol et
   */
  isPalletSelected(palletId: string): boolean {
    return this.selectedPalletIds.has(palletId);
  }

  /**
   * Grup kaydet (yeni veya güncelle)
   */
  saveGroup(): void {
    if (this.groupForm.invalid) {
      this.toastService.warning(this.translate.instant('PALLET_MESSAGES.FILL_REQUIRED_FIELDS'));
      return;
    }

    if (this.isGlobalGroup()) {
      this.toastService.info(this.translate.instant('PALLET_MESSAGES.CANNOT_EDIT_GLOBAL'));
      return;
    }

    this.isSaving = true;
    const formValue = this.groupForm.value;
    const palletIds = Array.from(this.selectedPalletIds);

    const groupData = {
      name: formValue.name,
      description: formValue.description,
      is_global: formValue.is_global,
      pallet_ids: palletIds
    };

    const operation = this.isNewGroup
      ? this.palletGroupService.create(groupData)
      : this.palletGroupService.update(this.selectedGroup!.id, groupData);

    operation.subscribe({
      next: (savedGroup) => {
        const message = this.isNewGroup ? this.translate.instant('PALLET_MESSAGES.GROUP_CREATED') : this.translate.instant('PALLET_MESSAGES.GROUP_UPDATED');
        this.toastService.success(message);
        this.isSaving = false;
        this.loadGroups();

        // Yeni grubsa onu seç
        if (this.isNewGroup) {
          setTimeout(() => this.selectGroup(savedGroup), 500);
        } else {
          this.selectGroup(savedGroup);
        }
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('PALLET_MESSAGES.GROUP_SAVE_ERROR'));
        this.isSaving = false;
      }
    });
  }

  /**
   * Grubu sil
   */
  deleteGroup(): void {
    if (!this.selectedGroup) return;

    if (!confirm(`"${this.selectedGroup.name}" ${this.translate.instant('PALLET_MESSAGES.DELETE_CONFIRM')}`)) {
      return;
    }

    if (this.isGlobalGroup()) {
      this.toastService.info(this.translate.instant('PALLET_MESSAGES.CANNOT_DELETE_GLOBAL'));
      return;
    }

    this.isSaving = true;
    this.palletGroupService.delete(this.selectedGroup.id).subscribe({
      next: () => {
        this.toastService.success(this.translate.instant('PALLET_MESSAGES.GROUP_DELETED'));
        this.isSaving = false;
        this.selectedGroup = null;
        this.isNewGroup = false;
        this.loadGroups();
      },
      error: (error) => {
        this.toastService.error(this.translate.instant('PALLET_MESSAGES.GROUP_DELETE_ERROR'));
        this.isSaving = false;
      }
    });
  }

  /**
   * Palet bilgilerini formatla (görüntüleme için)
   */
  formatPalletInfo(pallet: Pallet): string {
    return `${pallet.dimension.width}x${pallet.dimension.depth}x${pallet.dimension.height} cm - ${pallet.weight} kg`;
  }

  /**
   * Dialog'u kapat
   */
  close(): void {
    this.dialogRef.close();
  }
}
