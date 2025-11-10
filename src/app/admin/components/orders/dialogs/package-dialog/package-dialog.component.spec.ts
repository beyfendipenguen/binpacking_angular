import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackageDialogComponent } from './package-dialog.component';

describe('PackageDialogComponent', () => {
  let component: PackageDialogComponent;
  let fixture: ComponentFixture<PackageDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PackageDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PackageDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
