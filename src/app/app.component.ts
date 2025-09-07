import { Component, inject, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { AppState } from './store';
import { Store } from '@ngrx/store';
import * as UserActions from './store/user/user.actions';
import * as StepperActions from './store/stepper/stepper.actions';
import { LoadingComponent } from "./components/loading/loading.component";
import { filter } from 'rxjs';
import { LoadingService } from './components/loading/loading.service';



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
  constructor(public router: Router) {}

  ngOnInit(): void {
    this.store.dispatch(UserActions.loadUserFromStorage())
    this.store.dispatch(StepperActions.restoreLocalStorageData())

    setInterval(() => {
      console.log('🔢 Loading counter:', this.loadingService.counter, 'Loading state:', this.loadingService.loading());
    }, 500);

    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe((event: NavigationStart) => {
      console.log('🚀 Navigation başladı:', event.url);
      const isAuthRoute = event.url.startsWith('/auth');

      if (!isAuthRoute) {
        this.loadingService.loadingOn(); // Counter +1
      }
    });

    // Navigation bittiğinde, iptal olduğunda veya hata verdiğinde
    this.router.events.pipe(
      filter(event =>
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      )
    ).subscribe((event) => {
      console.log('🏁 Navigation bitti:', event);
      this.loadingService.loadingOff(); // Counter -1
    });
  }
  }


