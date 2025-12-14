import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
// import { StepperOrchestratorStatus } from '../dashboard/stepper/interfaces/stepper.interface';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root'
})
export class StepperOrchestratorService {
  // private _stepperStatus = new BehaviorSubject<StepperOrchestratorStatus>(StepperOrchestratorStatus.NEW);
  // public readonly stepperStatus$ = this._stepperStatus.asObservable();
  // public readonly currentStatus$ = toSignal(this.stepperStatus$,{initialValue: this._stepperStatus.value})


  // constructor() { }

  // setStepperStatus(status: StepperOrchestratorStatus): void {
  //   this._stepperStatus.next(status);
  // }



}
