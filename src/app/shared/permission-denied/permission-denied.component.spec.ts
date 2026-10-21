import { COMMON_TEST_PROVIDERS } from '../../testing/test-providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PermissionDeniedComponent } from './permission-denied.component';

describe('PermissionDeniedComponent', () => {
  let component: PermissionDeniedComponent;
  let fixture: ComponentFixture<PermissionDeniedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionDeniedComponent],
      providers: [...COMMON_TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PermissionDeniedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
