
/**
 * Package Changes Helper
 *
 * Package ve product karşılaştırma işlemleri için helper fonksiyonlar.
 *
 * Karşılaştırma Kriterleri:
 * - Package: pallet.id, alignment
 * - Product: product.id, product.count
 * - Product sırası önemlidir (drag-drop nedeniyle)
 */

import { PackageReadDto, PackageWriteDto } from "@app/features/interfaces/package.interface";
import { IUiPackage } from "../../interfaces/ui-interfaces/ui-package.interface";
import { PackageDetailReadDto } from "@app/features/interfaces/package-detail.interface";
import { mapUiPackageToPackageWriteDto } from "@app/features/mappers/package.mapper";

/**
 * İki ürünü karşılaştırır
 *
 * Karşılaştırma: product.id ve product.count
 *
 * @param packageDetail1 - İlk ürün
 * @param packageDetail2 - İkinci ürün
 * @returns true ise ürünler eşit
 */
function arePackageDetailsEqual(packageDetail1: PackageDetailReadDto, packageDetail2: PackageDetailReadDto): boolean {
  if (!packageDetail1 || !packageDetail2) return false;

  return (
    packageDetail1.id === packageDetail2.id &&
    packageDetail1.product.id === packageDetail2.product.id &&
    packageDetail1.count === packageDetail2.count &&
    packageDetail1.priority === packageDetail2.priority
  );
}

/**
 * İki ürün listesini karşılaştırır
 *
 * Önemli: Sıra önemlidir! [A, B] !== [B, A]
 * Çünkü drag-drop ile sıralama yapılıyor
 *
 * @param packageDetail1 - İlk ürün listesi
 * @param packageDetail2 - İkinci ürün listesi
 * @returns true ise listeler eşit (sıra dahil)
 */
function arePackageDetailListEqual(packageDetail1: any[], packageDetail2: any[]): boolean {
  if (!packageDetail1 || !packageDetail2) return false;
  if (packageDetail1.length !== packageDetail2.length) return false;

  // Sıralı karşılaştırma (index bazlı)
  return packageDetail1.every((product, index) =>
    arePackageDetailsEqual(product, packageDetail2[index])
  );
}

/**
 * İki paketi içerik bazında karşılaştırır (id'ye bakmaz)
 *
 * Karşılaştırma Kriterleri:
 * - pallet.id: Palet ID'si aynı mı?
 * - products: Ürünler aynı mı? (sıra, id, count)
 * - alignment: Vertical sort alignment aynı mı?
 *
 * NOT: Package.id'ye BAKMAZIZ (frontend'de generate edilir)
 *
 * @param pkg1 - İlk paket
 * @param pkg2 - İkinci paket
 * @returns true ise paketler eşit, false ise farklı
 *
 * @example
 * const pkg1 = { pallet: { id: 'p1' }, alignment: 'h', products: [A, B] };
 * const pkg2 = { pallet: { id: 'p1' }, alignment: 'h', products: [A, B] };
 * arePackagesEqual(pkg1, pkg2); // true
 *
 * const pkg3 = { pallet: { id: 'p1' }, alignment: 'v', products: [A, B] };
 * arePackagesEqual(pkg1, pkg3); // false (alignment farklı)
 */
export function arePackagesEqual(pkg1: IUiPackage, pkg2: PackageReadDto): boolean {
  if (!pkg1 || !pkg2) return false;

  // 1. Pallet ID karşılaştırması
  const palletId1 = pkg1.pallet?.id;
  const palletId2 = pkg2.pallet?.id;

  // Her ikisi de null ise eşit sayma (belirsiz durum)
  if (!palletId1 && !palletId2) {
    return false;
  }

  if (palletId1 !== palletId2) {
    return false;
  }

  // 2. Alignment karşılaştırması
  if (pkg1.alignment !== pkg2.alignment) {
    return false;
  }

  // 4. Products karşılaştırması (sıra önemli)
  if (!arePackageDetailListEqual(pkg1.package_details, pkg2.package_details)) {
    return false;
  }

  // Tüm kriterler eşit
  return true;
}

/**
 * Orijinal paketlerde eşleşen paketi bulur
 *
 * Eşleştirme: pallet.id bazlı
 *
 * @param pkg - Aranacak paket
 * @param candidates - Aday paketler listesi
 * @returns Eşleşen paket veya null
 *
 * @example
 * const current = { pallet: { id: 'p1' }, products: [A, B, C] };
 * const originals = [
 *   { pallet: { id: 'p1' }, products: [A, B] },
 *   { pallet: { id: 'p2' }, products: [D] }
 * ];
 * findMatchingPackage(current, originals); // İlk paketi döner
 */
function findMatchingPackage(
  pkg: IUiPackage,
  candidates: PackageReadDto[]
): PackageReadDto | null {

  const match = candidates.find(
    candidate => candidate.id === pkg.id
  );

  return match || null;
}

/**
 * Package Changes Interface
 *
 * Paket değişikliklerini temsil eder
 */
export interface PackageChanges {
  added: PackageWriteDto[];     // Yeni eklenen paketler
  modified: PackageWriteDto[];  // Değiştirilen paketler (güncel hali)
  deletedIds: string[];   // Silinen paketler (orijinal hali)
}

/**
 * Güncel paketler ile orijinal paketleri karşılaştırıp değişiklikleri hesaplar
 *
 * İş Mantığı:
 * 1. ADDED: packages'da var ama originalPackages'da yok (pallet.id bazlı)
 * 2. MODIFIED: Her ikisinde de var ama içerik farklı (arePackagesEqual = false)
 * 3. DELETED: originalPackages'da var ama packages'da yok
 *
 * Eşleştirme: pallet.id bazlı
 *
 * @param packages - Güncel paketler
 * @param originalPackages - DB'den gelen orijinal paketler
 * @returns Değişiklik objesi
 *
 * @example
 * const current = [
 *   { pallet: { id: 'p1' }, products: [A, B, C] },  // Modified (C eklendi)
 *   { pallet: { id: 'p3' }, products: [D] }         // Added
 * ];
 * const original = [
 *   { pallet: { id: 'p1' }, products: [A, B] },
 *   { pallet: { id: 'p2' }, products: [E] }         // Deleted
 * ];
 * calculatePackageChanges(current, original);
 * // {
 * //   added: [{ pallet: { id: 'p3' }, ... }],
 * //   modified: [{ pallet: { id: 'p1' }, ... }],
 * //   deleted: [{ pallet: { id: 'p2' }, ... }]
 * // }
 */
export function calculatePackageChanges(
  packages: IUiPackage[],
  originalPackages: PackageReadDto[]
): PackageChanges {
  const added: PackageWriteDto[] = [];
  const modified: PackageWriteDto[] = [];
  const deletedIds: string[] = [];


  // 1. Güncel paketleri tara (ADDED ve MODIFIED bul)
  packages.forEach(pkg => {
    const originalMatch = findMatchingPackage(pkg, originalPackages);

    if (!originalMatch) {
      // Orijinalde yok → ADDED
      if (pkg.pallet?.id !== undefined)
        added.push(mapUiPackageToPackageWriteDto(pkg))
    } else {
      // Orijinalde var → İçerik karşılaştır
      if (!arePackagesEqual(pkg, originalMatch))
        modified.push(mapUiPackageToPackageWriteDto(pkg))
    }
  });

  // 2. Orijinal paketleri tara (DELETED bul)
  originalPackages.forEach(originalPkg => {
    const currentMatch = packages.find(
      pkg => pkg.id === originalPkg.id
    );

    if (!currentMatch) {
      // Güncel listede yok → DELETED
      deletedIds.push(originalPkg.id); // Orijinal halini döndür
    }
  });

  return { added, modified, deletedIds };
}

/**
 * Paket listelerinin eşit olup olmadığını kontrol eder
 *
 * Kullanım: isDirty hesaplaması için
 *
 * @param packages - Güncel paketler
 * @param originalPackages - Orijinal paketler
 * @returns true ise listeler eşit
 */
export function arePackageListsEqual(
  packages: IUiPackage[],
  originalPackages: PackageReadDto[]
): boolean {

  const validPackages = packages.filter(pkg => pkg.package_details.length > 0);

  // Uzunluk kontrolü
  if (validPackages.length !== originalPackages.length) {
    return false;
  }

  // Her paketi karşılaştır
  // NOT: Paket sırası önemli değil, sadece içerik önemli
  // Bu yüzden her paketi orijinalde arayıp karşılaştırıyoruz
  return validPackages.every(pkg => {
    const originalMatch = findMatchingPackage(pkg, originalPackages);
    if (!originalMatch) return false;
    return arePackagesEqual(pkg, originalMatch);
  });
}
