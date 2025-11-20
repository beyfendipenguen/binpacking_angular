import { arePackagesEqual, calculatePackageChanges, arePackageListsEqual } from './package-changes.helper';

describe('PackageChangesHelper', () => {
  describe('arePackagesEqual', () => {
    it('aynı pallet.id, alignment ve products ise true dönmeli', () => {
      const pkg1 = {
        pallet: { id: 'p1' },
        alignment: 'h',
        products: [
          { id: 'prod1', count: 10 },
          { id: 'prod2', count: 20 }
        ]
      } as any;

      const pkg2 = {
        pallet: { id: 'p1' },
        alignment: 'h',
        products: [
          { id: 'prod1', count: 10 },
          { id: 'prod2', count: 20 }
        ]
      } as any;

      expect(arePackagesEqual(pkg1, pkg2)).toBe(true);
    });

    it('alignment farklı ise false dönmeli', () => {
      const pkg1 = {
        pallet: { id: 'p1' },
        alignment: 'h',
        products: []
      } as any;

      const pkg2 = {
        pallet: { id: 'p1' },
        alignment: 'v',
        products: []
      } as any;

      expect(arePackagesEqual(pkg1, pkg2)).toBe(false);
    });

    it('product sırası farklı ise false dönmeli', () => {
      const pkg1 = {
        pallet: { id: 'p1' },
        alignment: 'h',
        products: [
          { id: 'prod1', count: 10 },
          { id: 'prod2', count: 20 }
        ]
      } as any;

      const pkg2 = {
        pallet: { id: 'p1' },
        alignment: 'h',
        products: [
          { id: 'prod2', count: 20 },
          { id: 'prod1', count: 10 }
        ]
      } as any;

      expect(arePackagesEqual(pkg1, pkg2)).toBe(false);
    });
  });

  describe('calculatePackageChanges', () => {
    it('yeni paket eklendiğinde added listesinde olmalı', () => {
      const current = [
        { pallet: { id: 'p1' }, alignment: 'h', products: [] }
      ] as any;

      const original: any[] = [];

      const result = calculatePackageChanges(current, original);

      expect(result.added.length).toBe(1);
      expect(result.modified.length).toBe(0);
      expect(result.deletedIds.length).toBe(0);
    });

    it('paket değiştirildiğinde modified listesinde olmalı', () => {
      const current = [
        {
          pallet: { id: 'p1' },
          alignment: 'h',
          products: [{ id: 'prod1', count: 10 }]
        }
      ] as any;

      const original = [
        {
          pallet: { id: 'p1' },
          alignment: 'h',
          products: [{ id: 'prod1', count: 5 }]
        }
      ] as any;

      const result = calculatePackageChanges(current, original);

      expect(result.added.length).toBe(0);
      expect(result.modified.length).toBe(1);
      expect(result.deletedIds.length).toBe(0);
    });
  });
});
