import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { IGroup } from '../interfaces/permission.interface';

@Injectable({
  providedIn: 'root',
})
export class GroupService extends GenericCrudService<IGroup, number> {
  constructor(http: HttpClient) {
    super(http, 'access_control/groups');
  }
}
