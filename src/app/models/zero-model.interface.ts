import { User } from "../auth/models/user.model";

export interface ZeroModel {
  id: string; //UUID
  created_at?: Date | null;
  updated_at?: Date | null;
  created_by?: User | null; //UUID user
  updated_by?: User | null; //UUID user
  deleted_time?: Date | null; //DateTime
  is_deleted?: boolean | null; //boolean
}
