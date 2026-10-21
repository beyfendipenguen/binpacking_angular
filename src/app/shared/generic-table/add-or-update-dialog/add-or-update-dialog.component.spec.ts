import { COMMON_TEST_PROVIDERS } from '../../../testing/test-providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddOrUpdateDialogComponent } from './add-or-update-dialog.component';

describe('AddOrUpdateDialogComponent', () => {
  let component: AddOrUpdateDialogComponent;
  let fixture: ComponentFixture<AddOrUpdateDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddOrUpdateDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddOrUpdateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
