import { User } from "../auth/models/user.model";

export interface Base {
  id: string; //UUID
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: User | null; //UUID user
  updated_by?: User | null; //UUID user
  deleted_time?: string | null; //DateTime
  is_deleted?: boolean | null; //boolean
}
