import { Base } from '@core/interfaces/base.interface';
import { Pallet } from './pallet.interface';
import { PackageDetailReadDto, PackageDetailWriteDto } from './package-detail.interface';

export interface PackageReadDto extends Base {
  pallet: Pallet;
  order_id: string;
  name: string;
  is_remaining: boolean;
  alignment: string;
  height: number;
  package_details: PackageDetailReadDto[];
}

export interface PackageWriteDto extends Base {
  pallet_id: string;
  order_id: string;
  name: string;
  is_remaining: boolean;
  alignment: string;
  height: number;
  package_details: PackageDetailWriteDto[];
}