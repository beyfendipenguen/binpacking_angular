import { Injectable } from '@angular/core';
import { StepperState } from '@app/store';
import { initialStepperState } from '@app/store/stepper/stepper.state';
import { UiPackage } from '../components/ui-models/ui-package.model';
import { UiPallet } from '../components/ui-models/ui-pallet.model';
import { UiProduct } from '../components/ui-models/ui-product.model';


@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  private readonly STORAGE_KEY = 'enhanced_stepper_draft_data';
  private readonly STORAGE_VERSION = '2.0.0'; // Enhanced version
  private readonly EXPIRY_DAYS = 30;
  private readonly MAX_AUTO_SAVE_HISTORY = 50;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.cleanupExpiredData();
    this.initializeDeviceInfo();
  }

  saveStepperData(stepperState: StepperState) {
    try {
      // Enhanced storage with compression check
      const serializedData = JSON.stringify(stepperState);
      const dataSize = new Blob([serializedData]).size;

      localStorage.setItem(this.STORAGE_KEY, serializedData);

    } catch (error) {

      this.handleEnhancedStorageError(error);
    }
  }

  /**
   * ✅ Enhanced Data'yı localStorage'dan oku
   */
  getStepperData(): StepperState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        let response = {
          ...parsed,
          step2State: {
            ...parsed.step2State,
            packages: parsed.step2State.packages,
            remainingProducts: parsed.step2State.remainingProducts,
            originalRemainingProducts: parsed.step2State.originalRemainingProducts,
            originalPackages: parsed.step2State.originalPackages,
            deletedPackageIds: parsed.step2State.deletedPackageIds,
            modifiedPackages: parsed.step2State.modifiedPackages,
            addedPackages: parsed.step2State.addedPackages,
          },
        }


        return response;
      }
    } catch (error) {

      this.clearStorage();
    }
    return initialStepperState;
  }

  /**
   * ✅ Enhanced data migration
   */

  /**
   * ✅ Enhanced data validation
   */
  private validateStorageData(data: any): boolean {
    try {
      // Basic structure validation
      if (!data || typeof data !== 'object') return false;
      if (!data.step1 || !data.step2 || !data.step3) return false;
      if (typeof data.currentStep !== 'number') return false;
      if (!data.lastSaved) return false;

      // Enhanced step3 validation
      if (data.step3.isCompleted) {
        if (!data.step3.optimizationResult && !data.step3.reportFiles) {
          return false;
        }
      }

      return true;
    } catch (error) {

      return false;
    }
  }

  /**
   * ✅ Enhanced storage error handling
   */
  private handleEnhancedStorageError(error: any): void {
    try {
      // Check if quota exceeded
      if (error.name === 'QuotaExceededError') {

        return;
      }

      // Generic storage error cleanup
      const keys = Object.keys(localStorage);
      let cleanedCount = 0;

      keys.forEach(key => {
        if (key.startsWith('stepper_') && key !== this.STORAGE_KEY) {
          try {
            localStorage.removeItem(key);
            cleanedCount++;
          } catch (cleanupError) {

          }
        }
      });


    } catch (cleanupError) {

    }
  }
  allKeys(): string[] {
    let keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i)!);
    }
    return keys;
  }

  hasExistingData(): boolean {
    try {
      if (this.allKeys().includes(this.STORAGE_KEY))
        return true;
    } catch {
      return false;
    }
    return false;
  }

  clearStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);

    } catch (error) {

    }
  }

  /**
   * ✅ Enhanced helper methods
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDeviceInfo(): void {
    try {
      // Device info is already captured in getDeviceInfo()

    } catch (error) {

    }
  }

  private getDeviceInfo(): any {
    try {
      return {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      };
    } catch (error) {
      return {
        userAgent: 'Unknown',
        screenResolution: 'Unknown',
        platform: 'Unknown'
      };
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private isDataExpired(lastSaved: string): boolean {
    try {
      const lastSavedDate = new Date(lastSaved);
      const now = new Date();
      const daysDiff = (now.getTime() - lastSavedDate.getTime()) / (1000 * 3600 * 24);

      return daysDiff > this.EXPIRY_DAYS;
    } catch (error) {
      return true;
    }
  }

  private cleanupExpiredData(): void {
    try {
      const data = this.getStepperData();
      // getStepperData already handles expiry check
    } catch (error) {

      this.clearStorage();
    }
  }




  exportStorageData(): string {
    try {
      const data = this.getStepperData();
      return JSON.stringify(data, null, 2);
    } catch (error) {

      return '';
    }
  }

  importStorageData(jsonData: string): boolean {
    try {
      const importedData = JSON.parse(jsonData);

      if (this.validateStorageData(importedData)) {
        this.saveStepperData(importedData);

        return true;
      } else {

        return false;
      }
    } catch (error) {

      return false;
    }
  }

  /**
   * ✅ Enhanced storage diagnostics
   */
  getDiagnostics(): {
    storageAvailable: boolean;
    totalStorageUsed: number;
    availableSpace: number;
    isQuotaExceeded: boolean;
    lastError?: string;
  } {
    try {
      // Test storage availability
      const testKey = 'storage_test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);

      // Calculate storage usage
      let totalUsed = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalUsed += localStorage[key].length;
        }
      }

      return {
        storageAvailable: true,
        totalStorageUsed: totalUsed,
        availableSpace: 5242880 - totalUsed, // 5MB typical limit
        isQuotaExceeded: false
      };
    } catch (error) {
      return {
        storageAvailable: false,
        totalStorageUsed: 0,
        availableSpace: 0,
        isQuotaExceeded: typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'QuotaExceededError',
        lastError: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error)
      };
    }
  }

  /**
  * ✅ Generic localStorage methods for other services
  */
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      this.handleEnhancedStorageError(error);
    }
  }

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
    }
  }

  /**
   * ✅ Generic object storage helper
   */
  setObject(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (error) {
    }
  }

  getObject<T>(key: string): T | null {
    try {
      const stored = this.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }
}
