import { BaseModel } from "./base-model.interface";
import { Pallet } from "./pallet.interface";

export interface PalletGroup extends BaseModel {
  name: string;
  description?: string | null;
  is_global: boolean;
  pallets: Pallet[];
  pallet_count: number;
}
