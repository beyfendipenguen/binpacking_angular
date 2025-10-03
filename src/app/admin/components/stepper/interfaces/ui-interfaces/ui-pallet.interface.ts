import { Pallet } from "../../../../../models/pallet.interface";

export interface IUiPallet extends Pallet {
  name: string;
  ui_id: string;
}
