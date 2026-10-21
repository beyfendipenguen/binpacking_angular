import { COMMON_TEST_PROVIDERS } from '../../testing/test-providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CancelConfirmationDialogComponent } from './cancel-confirmation-dialog.component';

describe('CancelConfirmationDialogComponent', () => {
  let component: CancelConfirmationDialogComponent;
  let fixture: ComponentFixture<CancelConfirmationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CancelConfirmationDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CancelConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
