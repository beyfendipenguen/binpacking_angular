import { Routes } from '@angular/router';
import { SigninComponent } from './components/signin/signin.component';
import { LoginGuard } from './login.guard';

const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: SigninComponent,
    canActivate: [LoginGuard],
  },
  {
    path: 'reset-password/:uidb64/:token',
    loadComponent: () =>
      import('./components/reset-password/reset-password.component').then(
        (c) => c.ResetPasswordComponent
      ),
  },
];

export default AUTH_ROUTES;
