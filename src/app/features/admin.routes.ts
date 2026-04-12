import { Routes } from '@angular/router';
import { CustomersComponent } from './customers/customers.component';
import { OrdersComponent } from './orders/orders.component';
import { ProductsComponent } from './products/products.component';
import { ProfileComponent } from './profile/profile.component';
import { StepperComponent } from './stepper/stepper.component';
import { PalletsComponent } from './pallets/pallets.component';
import { TrucksComponent } from './trucks/trucks.component';
import { PermissionsComponent } from './permissions/permissions.component';
import { permissionGuard } from '@app/core/auth/guards/permission.guard';
import { StatsDashboardComponent } from './stats/stats-dashboard.component';

const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: StepperComponent,
    canActivate: [permissionGuard],
    data: { permission: 'orders.view_order' }
  },
  {
    path: 'orders',
    component: OrdersComponent,
    canActivate: [permissionGuard],
    data: { permission: ['orders.view_order'] }
  },
  {
    path: 'pallets',
    component: PalletsComponent,
    canActivate: [permissionGuard],
    data: { permission: ['logistics.view_pallet'] }
  },
  {
    path: 'products',
    component: ProductsComponent,
    canActivate: [permissionGuard],
    data: { permission: ['products.view_product'] }
  },
  {
    path: 'trucks',
    component: TrucksComponent,
    canActivate: [permissionGuard],
    data: { permission: ['logistics.view_truck'] }
  },
  {
    path: 'customers',
    component: CustomersComponent,
    canActivate: [permissionGuard],
    data: { permission: 'organizations.view_companyrelation' }
  },
  {
    path: 'permissions',
    component: PermissionsComponent,
    canActivate: [permissionGuard],
    data: { permission: 'access_control.view_permissionpage' }
  },
  {
    path: 'stats',
    component: StatsDashboardComponent,
    canActivate: [permissionGuard],
    data: { permission: 'access_control.view_statspage' }
  },
  {
    path: 'profile',
    component: ProfileComponent
  },
];

export default ADMIN_ROUTES;
