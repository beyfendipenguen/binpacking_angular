import {
  PackageGroupsActions as A,
  PackageGroupsState,
  initialPackageGroupsState,
  packageGroupsReducer,
  selectMultiSelectedIds,
  selectPackageGroups,
} from './package-groups.store';

const reduce = (state: PackageGroupsState, ...actions: any[]) =>
  actions.reduce((s, a) => packageGroupsReducer(s, a), state);

describe('packageGroups store', () => {
  describe('çoklu seçim', () => {
    it('setMultiSelection yinelenen id\'leri tekilleştirir', () => {
      const s = reduce(initialPackageGroupsState, A.setMultiSelection({ ids: ['a', 'b', 'a'] }));
      expect(s.multiSelectedIds).toEqual(['a', 'b']);
    });

    it('toggleMultiSelection: hepsi seçili değilse ekler', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.setMultiSelection({ ids: ['a'] }),
        A.toggleMultiSelection({ ids: ['a', 'b'] })
      );
      expect(s.multiSelectedIds.sort()).toEqual(['a', 'b']);
    });

    it('toggleMultiSelection: hepsi seçiliyse çıkarır', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.setMultiSelection({ ids: ['a', 'b', 'c'] }),
        A.toggleMultiSelection({ ids: ['a', 'b'] })
      );
      expect(s.multiSelectedIds).toEqual(['c']);
    });

    it('clearMultiSelection boşsa aynı state referansını döndürür', () => {
      const s = packageGroupsReducer(initialPackageGroupsState, A.clearMultiSelection());
      expect(s).toBe(initialPackageGroupsState);
    });

    it('clearMultiSelection seçimi temizler', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.setMultiSelection({ ids: ['a', 'b'] }),
        A.clearMultiSelection()
      );
      expect(s.multiSelectedIds).toEqual([]);
    });
  });

  describe('assignGroup', () => {
    it('en az 2 paketle grup oluşturur', () => {
      const s = reduce(initialPackageGroupsState, A.assignGroup({ no: '1', ids: ['a', 'b'] }));
      expect(s.groups).toEqual({ '1': ['a', 'b'] });
    });

    it('tek paketle grup oluşturmaz', () => {
      const s = packageGroupsReducer(initialPackageGroupsState, A.assignGroup({ no: '1', ids: ['a'] }));
      expect(s).toBe(initialPackageGroupsState);
    });

    it('aynı numaralı eski grubun yerine geçer', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.assignGroup({ no: '1', ids: ['a', 'b'] }),
        A.assignGroup({ no: '1', ids: ['c', 'd'] })
      );
      expect(s.groups).toEqual({ '1': ['c', 'd'] });
    });

    it('paket başka bir gruba taşınınca eski gruptan çıkar', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.assignGroup({ no: '1', ids: ['a', 'b', 'c'] }),
        A.assignGroup({ no: '2', ids: ['c', 'd'] })
      );
      expect(s.groups['2']).toEqual(['c', 'd']);
      expect(s.groups['1']).toEqual(['a', 'b']);
    });

    it('eski grupta tek paket kalırsa o grup dağılır', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.assignGroup({ no: '1', ids: ['a', 'b'] }),
        A.assignGroup({ no: '2', ids: ['b', 'c'] })
      );
      expect(s.groups['1']).toBeUndefined();
      expect(s.groups['2']).toEqual(['b', 'c']);
    });

    it('yinelenen id\'ler tekilleştirilir', () => {
      const s = reduce(initialPackageGroupsState, A.assignGroup({ no: '1', ids: ['a', 'a', 'b'] }));
      expect(s.groups['1']).toEqual(['a', 'b']);
    });
  });

  describe('dissolveGroup / clearGroups / reset', () => {
    const withGroups = () =>
      reduce(
        initialPackageGroupsState,
        A.assignGroup({ no: '1', ids: ['a', 'b'] }),
        A.assignGroup({ no: '2', ids: ['c', 'd'] })
      );

    it('dissolveGroup yalnızca ilgili grubu kaldırır', () => {
      const s = reduce(withGroups(), A.dissolveGroup({ no: '1' }));
      expect(s.groups).toEqual({ '2': ['c', 'd'] });
    });

    it('olmayan grubu dağıtmak state\'i değiştirmez', () => {
      const before = withGroups();
      expect(packageGroupsReducer(before, A.dissolveGroup({ no: '9' }))).toBe(before);
    });

    it('clearGroups tüm grupları siler ama seçimi korur', () => {
      const s = reduce(
        withGroups(),
        A.setMultiSelection({ ids: ['a'] }),
        A.clearGroups()
      );
      expect(s.groups).toEqual({});
      expect(s.multiSelectedIds).toEqual(['a']);
    });

    it('resetPackageGroups başlangıç durumuna döner', () => {
      const s = reduce(withGroups(), A.setMultiSelection({ ids: ['a'] }), A.resetPackageGroups());
      expect(s).toEqual(initialPackageGroupsState);
    });
  });

  describe('prunePackages', () => {
    it('artık var olmayan paketleri gruplardan ve seçimden temizler', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.assignGroup({ no: '1', ids: ['a', 'b', 'c'] }),
        A.setMultiSelection({ ids: ['a', 'x'] }),
        A.prunePackages({ validIds: ['a', 'b'] })
      );
      expect(s.groups).toEqual({ '1': ['a', 'b'] });
      expect(s.multiSelectedIds).toEqual(['a']);
    });

    it('grupta tek paket kalırsa grubu dağıtır', () => {
      const s = reduce(
        initialPackageGroupsState,
        A.assignGroup({ no: '1', ids: ['a', 'b'] }),
        A.prunePackages({ validIds: ['a'] })
      );
      expect(s.groups).toEqual({});
    });

    it('değişiklik yoksa aynı state referansını döndürür', () => {
      const before = reduce(initialPackageGroupsState, A.assignGroup({ no: '1', ids: ['a', 'b'] }));
      expect(packageGroupsReducer(before, A.prunePackages({ validIds: ['a', 'b', 'c'] }))).toBe(before);
    });
  });

  describe('selectors', () => {
    it('feature state yokken boş sabitleri döndürür', () => {
      const root = {} as any;
      expect(selectMultiSelectedIds(root)).toEqual([]);
      expect(selectPackageGroups(root)).toEqual({});
    });

    it('state varken değerleri döndürür', () => {
      const root = {
        packageGroups: { multiSelectedIds: ['a'], groups: { '1': ['a', 'b'] } },
      } as any;
      expect(selectMultiSelectedIds(root)).toEqual(['a']);
      expect(selectPackageGroups(root)).toEqual({ '1': ['a', 'b'] });
    });
  });
});
