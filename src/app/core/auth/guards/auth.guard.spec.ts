import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/services/auth.service';
import { AuthGuard } from './auth.guard';

/** Verilen exp (saniye) ile imzasız sahte bir JWT üretir. */
function fakeJwt(expSecondsFromNow: number): string {
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `h.${btoa(JSON.stringify({ exp }))}.s`;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let access: string | null;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    access = null;
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => access,
            refreshAccessToken$: jasmine.createSpy('refresh'),
          },
        },
      ],
    });
    guard = TestBed.inject(AuthGuard);
  });

  afterEach(() => localStorage.clear());

  const run = (url = '/orders') =>
    firstValueFrom(guard.canActivate({} as any, { url } as any));

  it('token yoksa girişe yönlendirir ve gidilmek istenen adresi saklar', async () => {
    expect(await run('/orders')).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(localStorage.getItem('redirectUrlAfterLogin')).toBe('/orders');
  });

  it('geçerli access ve refresh token varsa izin verir', async () => {
    access = fakeJwt(3600);
    localStorage.setItem('refresh_token', fakeJwt(7200));
    expect(await run()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('access ve refresh token süresi dolmuşsa tokenları siler ve girişe yönlendirir', async () => {
    access = fakeJwt(-100);
    localStorage.setItem('refresh_token', fakeJwt(-100));
    localStorage.setItem('access_token', 'x');
    expect(await run()).toBeFalse();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
