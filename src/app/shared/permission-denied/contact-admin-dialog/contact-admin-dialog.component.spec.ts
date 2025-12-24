import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactAdminDialogComponent } from './contact-admin-dialog.component';

describe('ContactAdminDialogComponent', () => {
  let component: ContactAdminDialogComponent;
  let fixture: ComponentFixture<ContactAdminDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactAdminDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactAdminDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
