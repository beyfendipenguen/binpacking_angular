import { Component, inject, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { AppState } from './store';
import { Store } from '@ngrx/store';
import * as UserActions from './store/user/user.actions';
import * as StepperActions from './store/stepper/stepper.actions';
import { filter } from 'rxjs';
import { LoadingComponent } from './shared/loading/loading.component';
import { LoadingService } from './shared/loading/loading.service';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  showLoading = false;
  store = inject(Store<AppState>);
  loadingService = inject(LoadingService)
  constructor(public router: Router) { }

  ngOnInit(): void {
    this.store.dispatch(UserActions.loadUserFromStorage())
    this.store.dispatch(StepperActions.restoreLocalStorageData())

    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe((event: NavigationStart) => {
      const isAuthRoute = event.url.startsWith('/auth');

      if (!isAuthRoute) {
        this.loadingService.loadingOn();
      }
    });

    this.router.events.pipe(
      filter(event =>
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      )
    ).subscribe((event) => {
      this.loadingService.loadingOff();
    });
  }
}


