import { Base } from '@core/interfaces/base.interface';
import { Pallet } from './pallet.interface';
import { PackageDetailReadDto, PackageDetailWriteDto } from './package-detail.interface';

export interface PackageReadDto extends Base {
  pallet: Pallet;
  order_id: string;
  name: number;
  is_remaining: boolean;
  alignment: string;
  height: number;
  // Backend'de hesaplanıp geliyor (Package modelinde kalıcı alan değil) —
  // bkz. PackageReadSerializer.get_weight(). Result Step'in orderResult/
  // deletedPackages state'indeki height/weight senkronizasyonu bunu okur.
  weight: number;
  priority: number | null;
  package_details: PackageDetailReadDto[];
}

export interface PackageWriteDto extends Base {
  pallet_id: string;
  order_id: string;
  name: number;
  is_remaining: boolean;
  alignment: string;
  height: number;
  priority: number | null;
  package_details: PackageDetailWriteDto[];
}
