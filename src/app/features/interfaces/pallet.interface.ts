import { Base } from "@app/core/interfaces/base.interface";
import { Company } from "./company.interface";
import { Dimension } from "./dimension.interface";

export interface Pallet extends Base {
  dimension: Dimension;
  weight: number;
  company?: Company;
}

export interface BulkUploadResponse {
  total_rows: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: {
    row: number;
    message: string;
  }[];
  success_details: {
    row:number;
    message:string
  }[];
}
