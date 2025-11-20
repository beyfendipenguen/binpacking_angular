import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { AppConfig } from '../../interfaces/app-config';
import { environment } from '../../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  // https://devblogs.microsoft.com/premier-developer/angular-how-to-editable-config-files/
  // https://lucasarcuri.com/blog/angular-load-config-file-before-app-starts/

  static settings: AppConfig;

  constructor(private http: HttpClient) { }

  load() {
    const jsonFile = `../../../config/config.${environment.name}.json`;
    return new Promise<void>((resolve, reject) => {
      firstValueFrom(this.http.get(jsonFile)).then((response: any) => {
        ConfigService.settings = <AppConfig>response;
        resolve();
      }).catch((reason => {
        reject(`Could not load file '${jsonFile}': ${JSON.stringify(reason)}`);
      }))
    });
  }
}
