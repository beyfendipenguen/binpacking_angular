import { TestBed } from '@angular/core/testing';

import { OrderResultService } from './order-result.service';

describe('OrderResultService', () => {
  let service: OrderResultService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderResultService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
