import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultStepComponent } from './result-step.component';

describe('ResultStepComponent', () => {
  let component: ResultStepComponent;
  let fixture: ComponentFixture<ResultStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultStepComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResultStepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
