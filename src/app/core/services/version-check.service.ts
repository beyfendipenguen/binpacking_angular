import { Injectable } from '@angular/core';
import { environment } from '@environments/environment.prod';

@Injectable({
  providedIn: 'root'
})
export class VersionCheckService {
  private readonly VERSION_KEY = 'app_version';

  initVersionCheck(): void {
    const currentVersion = environment.appVersion;
    const storedVersion = localStorage.getItem(this.VERSION_KEY);

    if (!storedVersion || storedVersion !== currentVersion) {
      localStorage.clear();
      localStorage.setItem(this.VERSION_KEY, currentVersion);
      window.location.reload();
    }
  }
}