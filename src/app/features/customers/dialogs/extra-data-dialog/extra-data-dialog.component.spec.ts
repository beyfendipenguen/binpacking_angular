import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtraDataDialogComponent } from './extra-data-dialog.component';

describe('ExtraDataDialogComponent', () => {
  let component: ExtraDataDialogComponent;
  let fixture: ComponentFixture<ExtraDataDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtraDataDialogComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ExtraDataDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
