import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from '../../../core/services/generic-crud.service';

@Injectable({
  providedIn: 'root'
})
export class FileService  extends GenericCrudService<File> {
  constructor(http: HttpClient) {
    super(http, 'orders/files');
  }
}
