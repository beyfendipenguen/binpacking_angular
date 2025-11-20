import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UnsubscriberService implements OnDestroy{
  // https://www.lucaspaganini.com/academy/angular-automatically-unsubscribe-observables-on-destroy
  private readonly _destroy$ = new Subject<void>();

  public readonly takeUntilDestroy = <T>(origin: Observable<T>): Observable<T> =>
    origin.pipe(takeUntil(this._destroy$))

  constructor() { }

  public ngOnDestroy(): void{
    this._destroy$.next();
    this._destroy$.complete();
  }
}
