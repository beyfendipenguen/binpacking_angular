import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GenericCrudService } from './generic-crud.service';

interface MockModel {
  id: string;
  name: string;
}

describe('GenericCrudService', () => {
  let service: GenericCrudService<MockModel>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], // Import HttpClientTestingModule for HttpClient
      providers: [
        { provide: 'ENDPOINT', useValue: 'mock-endpoint' } // Provide the required injection token
      ]
    });
    service = TestBed.inject(GenericCrudService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
