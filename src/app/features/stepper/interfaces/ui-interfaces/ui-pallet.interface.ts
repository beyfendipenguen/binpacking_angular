import { Pallet } from "@app/features/interfaces/pallet.interface";

export interface IUiPallet extends Pallet {
  name: string;
  ui_id: string;
}
