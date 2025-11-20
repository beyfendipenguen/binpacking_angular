
import { Base } from "../core/interfaces/base.interface";
import { Pallet } from "./pallet.interface";

export interface PalletGroup extends Base {
  name: string;
  description?: string | null;
  is_global: boolean;
  pallets: Pallet[];
  pallet_count: number;
}
