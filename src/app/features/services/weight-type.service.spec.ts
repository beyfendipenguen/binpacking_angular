import { TestBed } from '@angular/core/testing';

import { WeightTypeService } from './weight-type.service';

describe('WeightTypeService', () => {
  let service: WeightTypeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WeightTypeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
