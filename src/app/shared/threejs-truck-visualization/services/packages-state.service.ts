import { Injectable, signal, computed } from '@angular/core';
import { PackageData } from '@app/features/interfaces/order-result.interface';

@Injectable({
  providedIn: 'root'
})
export class PackagesStateService {

  // ✅ Signals
  private _deletedPackages = signal<PackageData[]>([]);
  private _processedPackages = signal<PackageData[]>([]);
  private _selectedPackage = signal<PackageData | null>(null);

  // ✅ Read-only getters
  deletedPackages = this._deletedPackages.asReadonly();
  processedPackages = this._processedPackages.asReadonly();
  selectedPackage = this._selectedPackage.asReadonly();

  // ✅ Computed
  deletedCount = computed(() => this._deletedPackages().length);
  processedCount = computed(() => this._processedPackages().length);
  totalCount = computed(() => this.deletedCount() + this.processedCount());

  // ✅ Callbacks
  private onPackageRemovedCallback?: (pkg: PackageData) => void;
  private onPackageAddedCallback?: (pkg: PackageData) => void;

  /**
   * Package silindiğinde çağrılacak callback'i set et
   */
  setOnPackageRemovedCallback(callback: (pkg: PackageData) => void): void {
    this.onPackageRemovedCallback = callback;
  }

  /**
   * Package eklendiğinde çağrılacak callback'i set et
   */
  setOnPackageAddedCallback(callback: (pkg: PackageData) => void): void {
    this.onPackageAddedCallback = callback;
  }

  /**
   * Package'ları her iki listeden de çıkarır (processed + deleted)
   * Step2'den silme işleminde kullanılır
   */
  removeFromBothLists(pkgIds: string | string[]): void {
    const idsToRemove = Array.isArray(pkgIds) ? pkgIds : [pkgIds];
    const idsSet = new Set(idsToRemove);

    // ✅ Silinecek package'ları topla (callback için)
    const toRemove = [
      ...this._processedPackages().filter(pkg => idsSet.has(pkg.pkgId)),
      ...this._deletedPackages().filter(pkg => idsSet.has(pkg.pkgId))
    ];

    // Processed'dan çıkar
    this._processedPackages.update(arr =>
      arr.filter(pkg => !idsSet.has(pkg.pkgId))
    );

    // Deleted'dan çıkar
    this._deletedPackages.update(arr =>
      arr.filter(pkg => !idsSet.has(pkg.pkgId))
    );

    // ✅ Callback'i çağır (mesh cleanup için)
    if (this.onPackageRemovedCallback) {
      toRemove.forEach(pkg => this.onPackageRemovedCallback!(pkg));
    }

  }

  /**
   * Processed packages'tan pkgId'lere göre çıkarır
   */
  removeFromProcessedPackages(pkgIds: string | string[]): void {
    const idsToRemove = Array.isArray(pkgIds) ? pkgIds : [pkgIds];
    const idsSet = new Set(idsToRemove);

    // ✅ Silinecek package'ları topla
    const toRemove = this._processedPackages().filter(pkg => idsSet.has(pkg.pkgId));

    this._processedPackages.update(arr =>
      arr.filter(pkg => !idsSet.has(pkg.pkgId))
    );

    // ✅ Callback'i çağır
    if (this.onPackageRemovedCallback) {
      toRemove.forEach(pkg => this.onPackageRemovedCallback!(pkg));
    }

  }

  /**
   * Deleted packages'tan pkgId'lere göre çıkarır
   */
  removeFromDeletedPackages(pkgIds: string | string[]): void {
    const idsToRemove = Array.isArray(pkgIds) ? pkgIds : [pkgIds];
    const idsSet = new Set(idsToRemove);

    const toRemove = this._deletedPackages().filter(pkg => idsSet.has(pkg.pkgId));

    this._deletedPackages.update(arr =>
      arr.filter(pkg => !idsSet.has(pkg.pkgId))
    );

    if (this.onPackageRemovedCallback) {
      toRemove.forEach(pkg => this.onPackageRemovedCallback!(pkg));
    }

  }

  /**
   * Processed packages'a yeni package(ler) ekler
   */
  addToProcessedPackages(packages: PackageData | PackageData[]): void {
    const toAdd = Array.isArray(packages) ? packages : [packages];
    this._processedPackages.update(arr => [...arr, ...toAdd]);

    if (this.onPackageAddedCallback) {
      toAdd.forEach(pkg => this.onPackageAddedCallback!(pkg));
    }
  }


  // ========================================
  // DELETED PACKAGES
  // ========================================

  /**
   * Deleted packages listesini tamamen değiştirir
   */
  setDeletedPackages(packages: PackageData[]): void {
    this._deletedPackages.set(packages);
  }

  /**
   * Deleted packages'a yeni package(ler) ekler
   */
  addToDeletedPackages(packages: PackageData | PackageData[]): void {
    const toAdd = Array.isArray(packages) ? packages : [packages];
    this._deletedPackages.update(arr => [...arr, ...toAdd]);
  }

  /**
   * Deleted packages'ı tamamen temizler
   */
  clearDeletedPackages(): void {
    this._deletedPackages.set([]);
  }

  /**
   * Deleted packages'tan pkgId'ye göre bulur
   */
  getDeletedPackageById(pkgId: string): PackageData | undefined {
    return this._deletedPackages().find(pkg => pkg.pkgId === pkgId);
  }

  // ========================================
  // PROCESSED PACKAGES
  // ========================================

  /**
   * Processed packages listesini tamamen değiştirir
   */
  setProcessedPackages(packages: PackageData[]): void {
    this._processedPackages.set(packages);
  }


  /**
   * Processed packages'tan bir package'ı günceller
   */
  updateProcessedPackage(updatedPackage: PackageData): void {
    this._processedPackages.update(arr =>
      arr.map(pkg => pkg.pkgId === updatedPackage.pkgId ? updatedPackage : pkg)
    );
  }

  /**
   * Processed packages'ı tamamen temizler
   */
  clearProcessedPackages(): void {
    this._processedPackages.set([]);
  }

  /**
   * Processed packages'tan pkgId'ye göre bulur
   */
  getProcessedPackageById(pkgId: string): PackageData | undefined {
    return this._processedPackages().find(pkg => pkg.pkgId === pkgId);
  }

  // ========================================
  // PACKAGE TRANSFER (Delete ↔ Restore)
  // ========================================

  /**
   * Package'ı processed'dan deleted'a taşır
   */
  moveToDeleted(pkgId: string): void {
    const pkg = this.getProcessedPackageById(pkgId);
    if (pkg) {
      this.removeFromProcessedPackages(pkgId);
      this.addToDeletedPackages(pkg);
    }
  }

  /**
   * Package'ı deleted'dan processed'a taşır
   */
  moveToProcessed(pkgId: string): void {
    const pkg = this.getDeletedPackageById(pkgId);
    if (pkg) {
      this.removeFromDeletedPackages(pkgId);
      this.addToProcessedPackages(pkg);
    }
  }

  /**
   * Multiple package'ları processed'dan deleted'a taşır
   */
  moveManyToDeleted(pkgIds: string[]): void {
    const packages = pkgIds
      .map(id => this.getProcessedPackageById(id))
      .filter((pkg): pkg is PackageData => pkg !== undefined);

    if (packages.length > 0) {
      this.removeFromProcessedPackages(pkgIds);
      this.addToDeletedPackages(packages);
    }
  }

  /**
   * Multiple package'ları deleted'dan processed'a taşır
   */
  moveManyToProcessed(pkgIds: string[]): void {
    const packages = pkgIds
      .map(id => this.getDeletedPackageById(id))
      .filter((pkg): pkg is PackageData => pkg !== undefined);

    if (packages.length > 0) {
      this.removeFromDeletedPackages(pkgIds);
      this.addToProcessedPackages(packages);
    }
  }

  // ========================================
  // SELECTED PACKAGE
  // ========================================

  /**
   * Package'ı seçer
   */
  selectPackage(packageData: PackageData | null): void {
    this._selectedPackage.set(packageData);
  }

  /**
   * Seçimi kaldırır
   */
  clearSelection(): void {
    this._selectedPackage.set(null);
  }

  // ========================================
  // UTILITY
  // ========================================

  /**
   * Tüm state'i temizler
   */
  resetAll(): void {
    this._deletedPackages.set([]);
    this._processedPackages.set([]);
    this._selectedPackage.set(null);
  }

  /**
   * Package ID'nin nerede olduğunu bulur
   */
  findPackageLocation(pkgId: string): 'deleted' | 'processed' | null {
    if (this.getDeletedPackageById(pkgId)) return 'deleted';
    if (this.getProcessedPackageById(pkgId)) return 'processed';
    return null;
  }

  /**
   * Tüm package'ları döner (deleted + processed)
   */
  getAllPackages(): PackageData[] {
    return [...this._deletedPackages(), ...this._processedPackages()];
  }

  /**
   * State'in snapshot'ını alır
   */
  getSnapshot() {
    return {
      deleted: this._deletedPackages(),
      processed: this._processedPackages(),
      selected: this._selectedPackage(),
      counts: {
        deleted: this.deletedCount(),
        processed: this.processedCount(),
        total: this.totalCount()
      }
    };
  }
}
