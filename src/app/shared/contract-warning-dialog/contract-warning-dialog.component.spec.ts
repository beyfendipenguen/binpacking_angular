import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContractWarningDialogComponent } from './contract-warning-dialog.component';

describe('ContractWarningDialogComponent', () => {
  let component: ContractWarningDialogComponent;
  let fixture: ComponentFixture<ContractWarningDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractWarningDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContractWarningDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
