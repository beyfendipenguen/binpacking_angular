import { PackageDetailReadDto } from "@app/features/interfaces/package-detail.interface";
import { IUiPallet } from "./ui-pallet.interface";

export interface IUiPackage {
  id: string;
  pallet: IUiPallet | null;
  order_id: string;
  package_details: PackageDetailReadDto[];
  is_remaining: boolean;
  name: string;
  alignment: string;
  height: number;
}
