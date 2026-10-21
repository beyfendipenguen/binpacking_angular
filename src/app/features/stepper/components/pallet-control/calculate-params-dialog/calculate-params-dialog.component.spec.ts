import { COMMON_TEST_PROVIDERS } from '../../../../../testing/test-providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalculateParamsDialogComponent } from './calculate-params-dialog.component';

describe('CalculateParamsDialogComponent', () => {
  let component: CalculateParamsDialogComponent;
  let fixture: ComponentFixture<CalculateParamsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalculateParamsDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalculateParamsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
