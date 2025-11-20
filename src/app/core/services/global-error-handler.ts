import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, inject, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(private router: Router, private zone: NgZone) { }

  handleError(error: any): void {
    if (error instanceof HttpErrorResponse) {
      this.handleHttpError(error);
    } else {

      // this.zone.run(() => {
      //   this.router.navigate(['error'], { queryParams: { error: error.message | error } });
      // })
    }
  }

  handleHttpError(error: HttpErrorResponse): void {

  }

}
