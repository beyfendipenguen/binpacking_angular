/**
 * Login sonrası belirli şirketlerin (company) veya belirli kullanıcıların
 * (userId) varsayılan ('/') yerine farklı bir sayfaya yönlendirilmesini
 * sağlayan generic kural tanımı.
 *
 * Kullanım: RULES listesine aşağıdaki gibi bir satır eklemek yeterli — kod
 * tarafında başka bir değişiklik gerekmez:
 *   { companyId: '<Company.id (UUID)>', redirectUrl: '<route>' }
 *   { userId: '<User.id (UUID)>', redirectUrl: '<route>' }
 * Bir kuralda companyId ve userId birlikte de verilebilir; userId eşleşmesi
 * companyId'den önceliklidir (bkz. resolve()).
 *
 * NOT: Bu kural SADECE normal (deep-link olmayan) login akışında devreye girer.
 * Kullanıcı korumalı bir sayfaya gitmeye çalışıp login'e düşmüşse (ör.
 * `redirectUrlAfterLogin` doluysa, bkz. auth.service.ts), o özel yönlendirme
 * her zaman önceliklidir ve buradaki kurallarla ezilmez
 * (bkz. user.effects.ts -> loadUserSuccess$).
 */
export interface LoginRedirectRule {
  /** Company.id (UUID, bkz. organizations.Company) — opsiyonel */
  companyId?: string;
  /** User.id (UUID) — opsiyonel, tanımlıysa companyId'den önce kontrol edilir */
  userId?: string;
  /** Router.navigate([...]) ile açılacak yol, ör. '/integration' */
  redirectUrl: string;
}

export class LoginRedirectRules {
  private static readonly RULES: LoginRedirectRule[] = [
    // { userId: '22222222-2222-2222-2222-222222222222', redirectUrl: '/integration' },
    { companyId: '3b54034c-44f0-41f3-82a0-f43845a2f43f', redirectUrl: '/integration' },
  ];

  /**
   * Verilen companyId/userId için tanımlı bir override varsa döner, yoksa null.
   * Önce userId eşleşmesi aranır, bulunamazsa companyId eşleşmesine bakılır.
   * Aynı kriter için birden fazla kural tanımlanırsa ilk eşleşen kullanılır.
   */
  static resolve(
    companyId: string | null | undefined,
    userId: string | null | undefined
  ): string | null {
    if (userId) {
      const byUser = this.RULES.find((r) => r.userId && r.userId === userId);
      if (byUser) return byUser.redirectUrl;
    }

    if (companyId) {
      const byCompany = this.RULES.find(
        (r) => r.companyId && r.companyId === companyId
      );
      if (byCompany) return byCompany.redirectUrl;
    }

    return null;
  }
}
