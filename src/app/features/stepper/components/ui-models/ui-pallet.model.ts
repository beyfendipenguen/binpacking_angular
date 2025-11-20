import { Company } from '@app/features/interfaces/company.interface';
import { Dimension } from '@app/features/interfaces/dimension.interface';
import { v4 as Guid } from 'uuid';
import { IUiPallet } from '../../interfaces/ui-interfaces/ui-pallet.interface';

export class UiPallet implements IUiPallet {
  name: string;
  dimension: Dimension;
  weight: number;
  company?: Company | undefined;
  ui_id: string;
  id: string;
  constructor(init: Partial<IUiPallet>) {
    this.ui_id = Guid();
    this.name =
      init.dimension?.depth != null && init.dimension?.width != null
        ? `${Math.trunc(init.dimension.depth)} X ${Math.trunc(
          init.dimension.width
        )}`
        : 'Unnamed Pallet';
    this.dimension = init.dimension!;
    this.weight = init.weight!;
    this.id = init.id!;
    this.company = init.company;
  }
}
