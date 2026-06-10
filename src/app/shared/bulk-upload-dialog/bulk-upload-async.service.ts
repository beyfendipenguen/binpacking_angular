import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, takeWhile, take } from 'rxjs';
import {
  BulkUploadJobResponse,
  BulkUploadStatusResponse
} from './bulk-upload.config';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300;

@Injectable({ providedIn: 'root' })
export class BulkUploadAsyncService {
  private http = inject(HttpClient);

  upload(file: File, uploadUrl: string): Observable<BulkUploadStatusResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<BulkUploadJobResponse>(uploadUrl, formData).pipe(
      switchMap(({ task_id }) => this.pollStatus(uploadUrl, task_id))
    );
  }

  private pollStatus(baseUrl: string, taskId: string): Observable<BulkUploadStatusResponse> {
    const statusUrl = `${baseUrl}status/${taskId}/`;

    return interval(POLL_INTERVAL_MS).pipe(
      take(MAX_POLL_ATTEMPTS),
      switchMap(() => this.http.get<BulkUploadStatusResponse>(statusUrl)),
      takeWhile(
        (response) => response.state === 'PENDING' || response.state === 'STARTED',
        true
      )
    );
  }
}
