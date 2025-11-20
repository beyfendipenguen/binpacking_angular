import { TestBed } from '@angular/core/testing';

import { PackageDetailService } from './package-detail.service';

describe('PackageDetailService', () => {
  let service: PackageDetailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PackageDetailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
