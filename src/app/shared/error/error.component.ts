import { Component, OnInit, signal, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { MatFabButton } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-error',
  imports: [MatFabButton, MatIcon, RouterModule,
    TranslateModule
  ],
  templateUrl: './error.component.html',
  styles: []
})
export class ErrorComponent implements OnInit {


  private translate = inject(TranslateService);
  errorMessage = signal('')

  constructor(private route: ActivatedRoute) { }


  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.errorMessage.set(params['message'] || this.translate.instant('ERROR_PAGE.UNKNOWN_ERROR'))
    })
  }
}
