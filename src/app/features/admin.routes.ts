import { Routes } from '@angular/router';
import { EmployeesComponent } from './employees/employees.component';
import { OrdersComponent } from './orders/orders.component';
import { ProductsComponent } from './products/products.component';
import { ProfileComponent } from './profile/profile.component';
import { StepperComponent } from './stepper/stepper.component';

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
