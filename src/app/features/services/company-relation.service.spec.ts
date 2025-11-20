import { TestBed } from '@angular/core/testing';

import { CompanyRelationService } from './company-relation.service';

describe('CompanyRelationService', () => {
  let service: CompanyRelationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanyRelationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
