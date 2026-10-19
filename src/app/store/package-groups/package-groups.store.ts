import { createActionGroup, createFeatureSelector, createReducer, createSelector, emptyProps, on, props } from '@ngrx/store';

/**
 * 3D görünümde çoklu paket seçimi + numaralı paket grupları (SADECE oturum —
 * persist edilmez). `pkgId` değerleriyle çalışır.
 *
 * - multiSelectedIds: Ctrl+tık / kutu seçimiyle seçilen paketler.
 * - groups: { '1': [pkgId...], '2': [...] } — gruplu paketler kilitli bir blok
 *   gibi taşınır (bkz. ThreeJSTruckVisualizationComponent).
 */
export interface PackageGroupsState {
  multiSelectedIds: string[];
  groups: Record<string, string[]>;
}

export const initialPackageGroupsState: PackageGroupsState = {
  multiSelectedIds: [],
  groups: {},
};

export const PackageGroupsActions = createActionGroup({
  source: 'Package Groups',
  events: {
    'Set Multi Selection': props<{ ids: string[] }>(),
    'Toggle Multi Selection': props<{ ids: string[] }>(),
    'Clear Multi Selection': emptyProps(),

    // Seçili paketleri `no` numaralı gruba ata (aynı numaralı eski grup dağılır;
    // paketler başka gruptaysa oradan çıkar).
    'Assign Group': props<{ no: string; ids: string[] }>(),
    'Dissolve Group': props<{ no: string }>(),
    // Paketler artık yoksa (silindi / yeniden hesaplandı) gruplardan ve seçimden temizle
    'Prune Packages': props<{ validIds: string[] }>(),
    'Clear Groups': emptyProps(),
    'Reset Package Groups': emptyProps(),
  },
});

const stripIds = (groups: Record<string, string[]>, ids: Set<string>): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [no, members] of Object.entries(groups)) {
    const left = members.filter(id => !ids.has(id));
    // 1 kişilik grup anlamsız: dağıt
    if (left.length > 1) out[no] = left;
  }
  return out;
};

export const packageGroupsReducer = createReducer(
  initialPackageGroupsState,

  on(PackageGroupsActions.setMultiSelection, (state, { ids }) => ({
    ...state,
    multiSelectedIds: Array.from(new Set(ids)),
  })),

  on(PackageGroupsActions.toggleMultiSelection, (state, { ids }) => {
    const current = new Set(state.multiSelectedIds);
    const allIn = ids.every(id => current.has(id));
    ids.forEach(id => (allIn ? current.delete(id) : current.add(id)));
    return { ...state, multiSelectedIds: Array.from(current) };
  }),

  on(PackageGroupsActions.clearMultiSelection, (state) =>
    state.multiSelectedIds.length ? { ...state, multiSelectedIds: [] } : state),

  on(PackageGroupsActions.assignGroup, (state, { no, ids }) => {
    const unique = Array.from(new Set(ids));
    if (unique.length < 2) return state;
    const without = stripIds(
      Object.fromEntries(Object.entries(state.groups).filter(([k]) => k !== no)),
      new Set(unique)
    );
    return { ...state, groups: { ...without, [no]: unique } };
  }),

  on(PackageGroupsActions.dissolveGroup, (state, { no }) => {
    if (!(no in state.groups)) return state;
    const { [no]: _removed, ...rest } = state.groups;
    return { ...state, groups: rest };
  }),

  on(PackageGroupsActions.prunePackages, (state, { validIds }) => {
    const valid = new Set(validIds);
    const groups: Record<string, string[]> = {};
    for (const [no, members] of Object.entries(state.groups)) {
      const left = members.filter(id => valid.has(id));
      if (left.length > 1) groups[no] = left;
    }
    const multi = state.multiSelectedIds.filter(id => valid.has(id));
    const unchanged =
      multi.length === state.multiSelectedIds.length &&
      JSON.stringify(groups) === JSON.stringify(state.groups);
    return unchanged ? state : { ...state, groups, multiSelectedIds: multi };
  }),

  on(PackageGroupsActions.clearGroups, (state) => ({ ...state, groups: {} })),
  on(PackageGroupsActions.resetPackageGroups, () => initialPackageGroupsState),
);

export const selectPackageGroupsState = createFeatureSelector<PackageGroupsState>('packageGroups');
const EMPTY_IDS: string[] = [];
const EMPTY_GROUPS: Record<string, string[]> = {};
export const selectMultiSelectedIds = createSelector(selectPackageGroupsState, s => s?.multiSelectedIds ?? EMPTY_IDS);
export const selectPackageGroups = createSelector(selectPackageGroupsState, s => s?.groups ?? EMPTY_GROUPS);
