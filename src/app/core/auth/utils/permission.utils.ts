import { Injectable } from "@angular/core";
import { IPermission, IRequiredPermission } from "../../interfaces/permission.interface";

@Injectable()
export class PermissionUtils {

    isEquelPermissions(
        permission: IPermission,
        requiredPermission: IRequiredPermission
    ): boolean {
        if (requiredPermission.id !== null) {
            return permission.id === requiredPermission.id
        }
        return permission.codename === requiredPermission.codename &&
            permission.content_type.app_label === requiredPermission.content_type.app_label &&
            permission.content_type.model === requiredPermission.content_type.model
    }

}
