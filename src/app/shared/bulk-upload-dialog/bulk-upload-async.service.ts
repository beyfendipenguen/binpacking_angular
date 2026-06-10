import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, interval, switchMap, takeWhile, take } from 'rxjs';
import { SKIP_LOADING } from '@app/shared/loading/skip-loading.token';
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

    const context = new HttpContext().set(SKIP_LOADING, true);

    return this.http.post<BulkUploadJobResponse>(uploadUrl, formData, { context }).pipe(
      switchMap(({ task_id }) => this.pollStatus(uploadUrl, task_id))
    );
  }

  private pollStatus(baseUrl: string, taskId: string): Observable<BulkUploadStatusResponse> {
    const statusUrl = `${baseUrl}status/${taskId}/`;
    const context = new HttpContext().set(SKIP_LOADING, true);

    return interval(POLL_INTERVAL_MS).pipe(
      take(MAX_POLL_ATTEMPTS),
      switchMap(() => this.http.get<BulkUploadStatusResponse>(statusUrl, { context })),
      takeWhile(
        (response) => response.state === 'PENDING' || response.state === 'STARTED',
        true
      )
    );
  }
}
