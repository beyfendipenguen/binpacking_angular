import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PalletControlComponent } from './pallet-control.component';

describe('PalletControlComponent', () => {
  let component: PalletControlComponent;
  let fixture: ComponentFixture<PalletControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PalletControlComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PalletControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
