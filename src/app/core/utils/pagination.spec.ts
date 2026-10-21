import { calculateLimitOffset } from './pagination.utils';

describe('calculateLimitOffset', () => {
  it('sayfa olayı yoksa varsayılan 10 kayıt ve 0 offset döner', () => {
    expect(calculateLimitOffset()).toEqual({ limit: 10, offset: 0 });
  });

  it('ilk sayfada offset 0 olur', () => {
    expect(calculateLimitOffset({ pageIndex: 0, pageSize: 25 } as any)).toEqual({ limit: 25, offset: 0 });
  });

  it('offset = pageSize * pageIndex', () => {
    expect(calculateLimitOffset({ pageIndex: 3, pageSize: 20 } as any)).toEqual({ limit: 20, offset: 60 });
  });
});
