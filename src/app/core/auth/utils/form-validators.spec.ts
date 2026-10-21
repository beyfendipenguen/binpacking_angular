import { FormControl } from '@angular/forms';
import { uuidValidator } from './form-validators';

describe('uuidValidator', () => {
  const validate = (value: any) => uuidValidator()(new FormControl(value));

  it('boş değeri geçerli sayar (zorunluluk ayrı validator ile verilir)', () => {
    expect(validate('')).toBeNull();
    expect(validate(null)).toBeNull();
  });

  it('geçerli UUID v4 değerini kabul eder', () => {
    expect(validate('3b241101-e2bb-4255-8caf-4136c566a962')).toBeNull();
  });

  it('büyük/küçük harf farkını yok sayar', () => {
    expect(validate('3B241101-E2BB-4255-8CAF-4136C566A962')).toBeNull();
  });

  it('UUID olmayan değeri reddeder', () => {
    expect(validate('abc')).toEqual({ invalidUuid4Format: true });
  });

  it('v4 olmayan UUID\'yi reddeder', () => {
    // 3. grubun ilk karakteri 1 (v1)
    expect(validate('3b241101-e2bb-1255-8caf-4136c566a962')).toEqual({ invalidUuid4Format: true });
  });
});
