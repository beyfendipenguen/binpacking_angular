import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UIState } from '../models/invoice-upload-interfaces';

@Injectable({
  providedIn: 'root'
})
export class UIStateManager {
  private uiStateSubject = new BehaviorSubject<UIState>({
    isLoading: false,
    excelUpload: false,
    dataRefreshInProgress: false
  });

  public uiState$: Observable<UIState> = this.uiStateSubject.asObservable();

  private updateState(updates: Partial<UIState>): void {
    const currentState = this.uiStateSubject.value;
    const newState = { ...currentState, ...updates };
    this.uiStateSubject.next(newState);
  }

  // Loading state methods
  setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  getLoading(): boolean {
    return this.uiStateSubject.value.isLoading;
  }

  // Excel upload state methods
  setExcelUpload(excelUpload: boolean): void {
    this.updateState({ excelUpload });
  }

  getExcelUpload(): boolean {
    return this.uiStateSubject.value.excelUpload;
  }

  // Data refresh state methods
  setDataRefreshInProgress(dataRefreshInProgress: boolean): void {
    this.updateState({ dataRefreshInProgress });
  }

  getDataRefreshInProgress(): boolean {
    return this.uiStateSubject.value.dataRefreshInProgress;
  }

  // Combined state methods
  startFileUpload(): void {
    this.updateState({
      isLoading: true,
      excelUpload: true
    });
  }

  finishFileUpload(): void {
    this.updateState({
      isLoading: false,
      excelUpload: false
    });
  }

  startSubmit(): void {
    this.updateState({
      isLoading: true
    });
  }

  finishSubmit(): void {
    this.updateState({
      isLoading: false
    });
  }

  startDataRefresh(): void {
    this.updateState({
      dataRefreshInProgress: true
    });
  }

  finishDataRefresh(): void {
    this.updateState({
      dataRefreshInProgress: false
    });
  }

  // Get current state
  getCurrentState(): UIState {
    return { ...this.uiStateSubject.value };
  }

  // Reset all states
  resetAllStates(): void {
    this.updateState({
      isLoading: false,
      excelUpload: false,
      dataRefreshInProgress: false
    });
  }

  // Utility methods for component
  isAnyOperationInProgress(): boolean {
    const state = this.uiStateSubject.value;
    return state.isLoading || state.excelUpload || state.dataRefreshInProgress;
  }

  canUserInteract(): boolean {
    return !this.isAnyOperationInProgress();
  }

  // State subscription helpers
  subscribeToLoadingState(): Observable<boolean> {
    return new Observable(observer => {
      this.uiState$.subscribe(state => {
        observer.next(state.isLoading);
      });
    });
  }

  subscribeToExcelUploadState(): Observable<boolean> {
    return new Observable(observer => {
      this.uiState$.subscribe(state => {
        observer.next(state.excelUpload);
      });
    });
  }

  subscribeToDataRefreshState(): Observable<boolean> {
    return new Observable(observer => {
      this.uiState$.subscribe(state => {
        observer.next(state.dataRefreshInProgress);
      });
    });
  }
}
