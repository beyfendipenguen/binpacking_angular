import { Routes } from '@angular/router';
import AUTH_ROUTES from './auth/auth.routes';
import ADMIN_ROUTES from './admin/admin.routes';
import { LayoutComponent } from './admin/components/layout/layout.component';
import { ErrorComponent } from './components/error/error.component';
import { AuthGuard } from './auth/auth.guard'; // ← BU SATIRI EKLEYİN

export const routes: Routes = [
    {
        path: 'auth',
        children: AUTH_ROUTES
    },
    {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard],
        children: ADMIN_ROUTES
    },
    {
        path: 'error',
        component: ErrorComponent,
    },
    {
        path: '**',
        redirectTo: '/auth/login'
    },
];
