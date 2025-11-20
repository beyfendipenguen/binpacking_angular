import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddOrUpdateDialogComponent } from './add-or-update-dialog-component';

describe('AddOrUpdateDialogComponent', () => {
  let component: AddOrUpdateDialogComponent;
  let fixture: ComponentFixture<AddOrUpdateDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddOrUpdateDialogComponent]
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
