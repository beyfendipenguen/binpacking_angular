import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { WeightCategory } from '../interfaces/weight-category.interface';

@Injectable({
  providedIn: 'root'
})
export class WeightCategoryService extends GenericCrudService<WeightCategory> {
  constructor(http: HttpClient) {
    super(http, 'products/weight-categories');
  }

  getCategories(): Observable<WeightCategory[]> {
    this.ensureApiUrl();
    return this.http.get<any>(`${this.apiUrl}`)
      .pipe(map(response => response.results ?? response));
  }
}
