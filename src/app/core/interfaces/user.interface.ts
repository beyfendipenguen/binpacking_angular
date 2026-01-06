import { Company } from "@app/features/interfaces/company.interface";
import { PermissionType } from "./permission.interface";

export interface User {
  password: string;
  last_login: Date | null;
  is_superuser: boolean;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: Date;
  id: string;
  company: Company;
  is_admin: boolean;
  phone: string | null;
  address: string;
  profile_picture: string;
  permissions: PermissionType[];
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}
