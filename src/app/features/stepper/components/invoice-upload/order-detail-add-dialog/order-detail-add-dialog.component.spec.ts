import { COMMON_TEST_PROVIDERS } from '../../../../../testing/test-providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderDetailAddDialogComponent } from './order-detail-add-dialog.component';

describe('OrderDetailAddDialogComponent', () => {
  let component: OrderDetailAddDialogComponent;
  let fixture: ComponentFixture<OrderDetailAddDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetailAddDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderDetailAddDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
