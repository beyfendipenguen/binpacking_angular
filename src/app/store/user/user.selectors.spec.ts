import { selectAllowUnplaced } from './user.selectors';

describe('selectAllowUnplaced', () => {
  const userWith = (flag: boolean | undefined): any => ({
    company: { report_profile: { template_schema: 'x', allow_unplaced: flag } },
  });

  it('bayrak true ise true döner', () => {
    expect(selectAllowUnplaced.projector(userWith(true))).toBeTrue();
  });

  it('bayrak yoksa/false ise false döner', () => {
    expect(selectAllowUnplaced.projector(userWith(false))).toBeFalse();
    expect(selectAllowUnplaced.projector(userWith(undefined))).toBeFalse();
  });

  it('kullanıcı/şirket/profil yoksa false döner', () => {
    expect(selectAllowUnplaced.projector(null)).toBeFalse();
    expect(selectAllowUnplaced.projector({ company: null } as any)).toBeFalse();
  });
});
