// ui-package.class.ts
import { PackageDetailReadDto } from '@app/features/interfaces/package-detail.interface';
import { IUiPackage } from '../../interfaces/ui-interfaces/ui-package.interface';
import { IUiPallet } from '../../interfaces/ui-interfaces/ui-pallet.interface';
import { v4 as Guid } from 'uuid';


export class UiPackage implements IUiPackage {
  // Non-reactive properties
  pallet: IUiPallet | null;
  id: string;
  name: number;
  package_details: PackageDetailReadDto[];
  alignment: string;
  height: number;
  order_id: string;
  is_remaining: boolean;

  constructor(init: Partial<IUiPackage>) {
    this.pallet = init.pallet || null;
    this.id = init.id || Guid();
    this.name = init.name || 0;
    this.height = init.height || 2400;
    this.order_id = init.order_id || "";
    this.package_details = init.package_details || [];
    this.is_remaining = init.is_remaining || false
    this.alignment = init.alignment || "h";
  }

}
