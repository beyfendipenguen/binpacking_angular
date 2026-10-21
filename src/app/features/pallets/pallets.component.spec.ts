import { COMMON_TEST_PROVIDERS } from '../../testing/test-providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PalletsComponent } from './pallets.component';

describe('PalletsComponent', () => {
  let component: PalletsComponent;
  let fixture: ComponentFixture<PalletsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PalletsComponent],
      providers: [...COMMON_TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PalletsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
