import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GenericCrudService } from '@app/core/services/generic-crud.service';
import { IGroup } from '../interfaces/permission.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GroupService extends GenericCrudService<IGroup, number> {
  constructor(http: HttpClient) {
    super(http, 'access_control/groups');
  }

  addUsers(groupId: number, userIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${groupId}/add-users/`, {
      user_ids: userIds
    });
  }

  removeUsers(groupId: number, userIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${groupId}/remove-users/`, {
      user_ids: userIds
    });
  }

  setUsers(groupId: number, userIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}${groupId}/set-users/`, {
      user_ids: userIds
    });
  }

  getMembers(groupId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${groupId}/members/`);
  }
}
