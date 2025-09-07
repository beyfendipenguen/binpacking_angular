import { Routes } from '@angular/router';
import { EmployeesComponent } from './components/employees/employees.component';
import { LogisticsComponent } from './components/logistics/logistics.component';
import { OrdersComponent } from './components/orders/orders.component';
import { ProductsComponent } from './components/products/products.component';
import { ProfileComponent } from './components/profile/profile.component';
import { StepperComponent } from './components/stepper/stepper.component';

const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: StepperComponent
  },
  {
    path: 'employees',
    component: EmployeesComponent
  },
  {
    path: 'logistics',
    component: LogisticsComponent
  },
  {
    path: 'orders',
    component: OrdersComponent
  },
  {
    path: 'products',
    component: ProductsComponent
  },
  {
    path: 'profile',
    component: ProfileComponent
  },
];

export default ADMIN_ROUTES;
