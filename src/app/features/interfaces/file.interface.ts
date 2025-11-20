import { Order } from './order.interface';
import { Base } from '@core/interfaces/base.interface';

export interface Document extends Base {
  order?: Order | null;
  file: string | File; // Genellikle bu alan backend'den gelen dosya URL'si olur
  type: string | null;
  name: string | null;
}
