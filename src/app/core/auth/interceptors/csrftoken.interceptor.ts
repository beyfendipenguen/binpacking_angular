import { HttpInterceptorFn, HttpRequest, HttpEvent, HttpHandlerFn } from '@angular/common/http';
import { Observable } from 'rxjs';

export const CsrfTokenInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const csrftoken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
  const csrfToken = csrftoken ? csrftoken.split('=')[1] : null;

  if (csrfToken) {
    const clonedRequest = req.clone({ setHeaders: { 'X-CSRFToken': csrfToken } });
    return next(clonedRequest);
  }
  return next(req);
};
