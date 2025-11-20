import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private configService: ConfigService) { }

  getApiUrl() {
    // Check if settings are loaded before trying to access them
    if (!ConfigService.settings || !ConfigService.settings.apiServer) {
      return ''; // Return an empty string or a default URL
    }
    return ConfigService.settings.apiServer.url;
  }
}
