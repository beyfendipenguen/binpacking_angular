import { Component, OnInit, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatFabButton } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-error',
  imports: [MatFabButton, MatIcon, RouterModule],
  templateUrl: './error.component.html',
  styles: []
})
export class ErrorComponent implements OnInit {

  errorMessage = signal('')

  constructor(private route: ActivatedRoute) { }


  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.errorMessage.set(params['message'] || 'Unkown error occurred.')
    })
  }
}
