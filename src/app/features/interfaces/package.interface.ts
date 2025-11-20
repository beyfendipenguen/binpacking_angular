import { Base } from '@core/interfaces/base.interface';
import { Company } from './company.interface';
import { Order } from './order.interface';
import { Pallet } from './pallet.interface';

export interface Package extends Base {
  // Ya pallet nesnesi ya da pallet_id olabilir
  pallet?: Pallet | null;
  pallet_id?: string;
  is_remaining: boolean;
  company?: Company;
  // Ya order nesnesi ya da order_id olabilir
  order?: Order;
  order_id?: string;
  name?: string | null;
  height: number;
  alignment: string;
}
