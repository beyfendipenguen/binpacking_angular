import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilesDialogComponent } from './files-dialog.component';

describe('FilesDialogComponent', () => {
  let component: FilesDialogComponent;
  let fixture: ComponentFixture<FilesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilesDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
