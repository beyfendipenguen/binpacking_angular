import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { GenericCrudService } from './generic-crud.service';
import { Document } from '@app/features/interfaces/file.interface';

@Injectable({
  providedIn: 'root'
})
export class FileService extends GenericCrudService<Document> {
  constructor(http: HttpClient) {
    super(http, 'orders/files');
  }
}
