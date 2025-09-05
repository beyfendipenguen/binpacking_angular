import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AppState } from './store';
import { Store } from '@ngrx/store';
import * as UserActions from './store/user/user.actions';
import * as StepperActions from './store/stepper/stepper.actions';
import { LoadingComponent } from "./components/loading/loading.component";



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  store = inject(Store<AppState>);

  constructor(public router: Router) {}

  ngOnInit(): void {
    this.store.dispatch(UserActions.loadUserFromStorage())
    this.store.dispatch(StepperActions.restoreLocalStorageData())
  }
}
