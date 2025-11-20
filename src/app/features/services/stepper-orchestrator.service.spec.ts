import { TestBed } from '@angular/core/testing';

import { StepperOrchestratorService } from './stepper-orchestrator.service';

describe('StepperOrchestratorService', () => {
  let service: StepperOrchestratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StepperOrchestratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
