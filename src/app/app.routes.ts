import { Routes } from '@angular/router';
import AUTH_ROUTES from './core/auth/auth.routes';
import { AuthGuard } from './core/auth/guards/auth.guard'; // ← BU SATIRI EKLEYİN
import ADMIN_ROUTES from './features/admin.routes';
import { LayoutComponent } from './features/layout/layout.component';
import { ErrorComponent } from './shared/error/error.component';
import { PermissionDeniedComponent } from './shared/permission-denied/permission-denied.component';

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
        path: 'unauthorized',
        component: PermissionDeniedComponent,
    },
    {
        path: '**',
        redirectTo: '/auth/login'
    },
];
