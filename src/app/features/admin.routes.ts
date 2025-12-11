import { Routes } from '@angular/router';
import { CustomersComponent } from './customers/customers.component';
import { OrdersComponent } from './orders/orders.component';
import { ProductsComponent } from './products/products.component';
import { ProfileComponent } from './profile/profile.component';
import { StepperComponent } from './stepper/stepper.component';
import { PalletsComponent } from './pallets/pallets.component';
import { TrucksComponent } from './trucks/trucks.component';

const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: StepperComponent
  },
  {
    path: 'orders',
    component: OrdersComponent
  },
  {
    path: 'pallets',
    component: PalletsComponent
  },
  {
    path: 'products',
    component: ProductsComponent
  },
  {
    path: 'trucks',
    component: TrucksComponent
  },
  {
    path: 'customers',
    component: CustomersComponent
  },
  {
    path: 'profile',
    component: ProfileComponent
  },
];

export default ADMIN_ROUTES;
