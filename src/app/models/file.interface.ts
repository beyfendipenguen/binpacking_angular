import { BaseModel } from './base-model.interface';
import { Order } from './order.interface';

export interface Document extends BaseModel {
  order?: Order | null;
  file: string | File; // Genellikle bu alan backend'den gelen dosya URL'si olur
  type: string | null;
  name: string | null;
}
