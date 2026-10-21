import { arePackagesEqual, calculatePackageChanges, arePackageListsEqual } from './package-changes.helper';

/** Güncel veri sözleşmesi: paket `package_details` taşır, eşleştirme `id` ile yapılır. */
const detail = (id: string, productId: string, count: number, priority = 0) =>
  ({ id, product: { id: productId }, count, priority } as any);

const pkg = (
  id: string,
  palletId: string | null,
  details: any[] = [],
  extra: Record<string, any> = {}
) =>
  ({
    id,
    pallet: palletId ? { id: palletId } : null,
    alignment: 'h',
    priority: 0,
    height: 0,
    is_remaining: false,
    name: 1,
    order_id: 'o1',
    package_details: details,
    ...extra,
  } as any);

describe('PackageChangesHelper', () => {
  describe('arePackagesEqual', () => {
    it('aynı pallet, alignment, priority ve ürünler ise true döner', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 10), detail('d2', 'prod2', 20)]);
      const b = pkg('1', 'p1', [detail('d1', 'prod1', 10), detail('d2', 'prod2', 20)]);
      expect(arePackagesEqual(a, b)).toBeTrue();
    });

    it('alignment farklıysa false döner', () => {
      expect(arePackagesEqual(pkg('1', 'p1'), pkg('1', 'p1', [], { alignment: 'v' }))).toBeFalse();
    });

    it('priority farklıysa false döner', () => {
      expect(arePackagesEqual(pkg('1', 'p1'), pkg('1', 'p1', [], { priority: 2 }))).toBeFalse();
    });

    it('palet farklıysa false döner', () => {
      expect(arePackagesEqual(pkg('1', 'p1'), pkg('1', 'p2'))).toBeFalse();
    });

    it('iki tarafta da palet yoksa (belirsiz durum) eşit saymaz', () => {
      expect(arePackagesEqual(pkg('1', null), pkg('1', null))).toBeFalse();
    });

    it('ürün sırası farklıysa false döner (drag-drop sırası önemli)', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 10), detail('d2', 'prod2', 20)]);
      const b = pkg('1', 'p1', [detail('d2', 'prod2', 20), detail('d1', 'prod1', 10)]);
      expect(arePackagesEqual(a, b)).toBeFalse();
    });

    it('ürün adedi farklıysa false döner', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 10)]);
      const b = pkg('1', 'p1', [detail('d1', 'prod1', 5)]);
      expect(arePackagesEqual(a, b)).toBeFalse();
    });

    it('null paket verilirse false döner', () => {
      expect(arePackagesEqual(null as any, pkg('1', 'p1'))).toBeFalse();
    });
  });

  describe('calculatePackageChanges', () => {
    it('orijinalde olmayan yeni paket added listesine girer', () => {
      const result = calculatePackageChanges([pkg('new', 'p1', [detail('d1', 'prod1', 1)])], []);
      expect(result.added.length).toBe(1);
      expect(result.modified.length).toBe(0);
      expect(result.deletedIds.length).toBe(0);
    });

    it('içeriği değişen paket modified listesine girer', () => {
      const current = [pkg('1', 'p1', [detail('d1', 'prod1', 10)])];
      const original = [pkg('1', 'p1', [detail('d1', 'prod1', 5)])];
      const result = calculatePackageChanges(current, original);
      expect(result.added.length).toBe(0);
      expect(result.modified.length).toBe(1);
      expect(result.deletedIds.length).toBe(0);
    });

    it('değişmeyen paket hiçbir listeye girmez', () => {
      const current = [pkg('1', 'p1', [detail('d1', 'prod1', 5)])];
      const original = [pkg('1', 'p1', [detail('d1', 'prod1', 5)])];
      const result = calculatePackageChanges(current, original);
      expect(result).toEqual({ added: [], modified: [], deletedIds: [] });
    });

    it('güncel listede olmayan orijinal paket deletedIds\'e girer', () => {
      const original = [pkg('1', 'p1', [detail('d1', 'prod1', 5)]), pkg('2', 'p2', [detail('d2', 'prod2', 5)])];
      const current = [pkg('1', 'p1', [detail('d1', 'prod1', 5)])];
      expect(calculatePackageChanges(current, original).deletedIds).toEqual(['2']);
    });

    it('paleti ve içeriği boşaltılan paket silinmiş sayılır', () => {
      const original = [pkg('1', 'p1', [detail('d1', 'prod1', 5)])];
      const current = [pkg('1', null, [])];
      const result = calculatePackageChanges(current, original);
      expect(result.deletedIds).toEqual(['1']);
      expect(result.added.length).toBe(0);
    });

    it('paletsiz ve içeriksiz yeni paket yok sayılır', () => {
      const result = calculatePackageChanges([pkg('new', null, [])], []);
      expect(result.added.length).toBe(0);
    });

    it('yazma DTO\'sunda palet kimliği ve ürün kimlikleri taşınır', () => {
      const result = calculatePackageChanges([pkg('new', 'p9', [detail('d1', 'prodX', 3)])], []);
      expect(result.added[0].pallet_id).toBe('p9');
      expect(result.added[0].package_details[0].product_id).toBe('prodX');
    });
  });

  describe('arePackageListsEqual (isDirty hesabı)', () => {
    it('aynı içerik, farklı sırada olsa da eşittir', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 1)]);
      const b = pkg('2', 'p2', [detail('d2', 'prod2', 2)]);
      expect(arePackageListsEqual([b, a], [a, b])).toBeTrue();
    });

    it('içeriksiz paketler sayılmaz', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 1)]);
      expect(arePackageListsEqual([a, pkg('2', 'p2', [])], [a])).toBeTrue();
    });

    it('paket sayısı farklıysa eşit değildir', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 1)]);
      expect(arePackageListsEqual([a], [])).toBeFalse();
    });

    it('orijinalde karşılığı olmayan paket varsa eşit değildir', () => {
      const a = pkg('1', 'p1', [detail('d1', 'prod1', 1)]);
      const b = pkg('2', 'p2', [detail('d2', 'prod2', 1)]);
      expect(arePackageListsEqual([a], [b])).toBeFalse();
    });
  });
});
