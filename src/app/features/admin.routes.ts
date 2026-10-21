import { Routes } from '@angular/router';
import { feedbackExitGuard } from './stepper/guards/feedback-exit.guard';
import { permissionGuard } from '@app/core/auth/guards/permission.guard';

// Sayfalar lazy yüklenir: three.js (stepper) ve echarts (stats) gibi ağır
// kütüphaneler ilk açılış (login) paketine girmez, sayfa açılınca inen ayrı
// parçalara (chunk) ayrılır.
const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./stepper/stepper.component').then(m => m.StepperComponent),
    canActivate: [permissionGuard],
    canDeactivate: [feedbackExitGuard],
    data: { permission: 'orders.view_order' }
  },
  {
    path: 'orders',
    loadComponent: () => import('./orders/orders.component').then(m => m.OrdersComponent),
    canActivate: [permissionGuard],
    data: { permission: ['orders.view_order'] }
  },
  {
    path: 'pallets',
    loadComponent: () => import('./pallets/pallets.component').then(m => m.PalletsComponent),
    canActivate: [permissionGuard],
    data: { permission: ['logistics.view_pallet'] }
  },
  {
    path: 'products',
    loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent),
    canActivate: [permissionGuard],
    data: { permission: ['products.view_product'] }
  },
  {
    path: 'trucks',
    loadComponent: () => import('./trucks/trucks.component').then(m => m.TrucksComponent),
    canActivate: [permissionGuard],
    data: { permission: ['logistics.view_truck'] }
  },
  {
    path: 'customers',
    loadComponent: () => import('./customers/customers.component').then(m => m.CustomersComponent),
    canActivate: [permissionGuard],
    data: { permission: 'organizations.view_companyrelation' }
  },
  {
    path: 'permissions',
    loadComponent: () => import('./permissions/permissions.component').then(m => m.PermissionsComponent),
    canActivate: [permissionGuard],
    data: { permission: 'access_control.view_permissionpage' }
  },
  {
    path: 'integration',
    loadComponent: () => import('./integration/integration.component').then(m => m.IntegrationComponent),
    canActivate: [permissionGuard],
    data: { permission: 'organizations.view_erpcredential' }
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats/stats-dashboard.component').then(m => m.StatsDashboardComponent),
    canActivate: [permissionGuard],
    data: { permission: 'access_control.view_statspage' }
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent)
  },
];

export default ADMIN_ROUTES;
