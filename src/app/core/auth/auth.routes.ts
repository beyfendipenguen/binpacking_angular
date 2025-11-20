import { Routes } from '@angular/router';
import { SigninComponent } from '../../features/auth/signin/signin.component';
import { LoginGuard } from './guards/login.guard';

const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: SigninComponent,
    canActivate: [LoginGuard],
  },
  {
    path: 'reset-password/:uidb64/:token',
    loadComponent: () =>
      import('../../features/auth/reset-password/reset-password.component').then(
        (c) => c.ResetPasswordComponent
      ),
  },
];

export default AUTH_ROUTES;
