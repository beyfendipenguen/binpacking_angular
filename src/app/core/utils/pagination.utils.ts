import { PageEvent } from "@angular/material/paginator";
import { IRequiredPermission, IPermission } from '@core/interfaces/permission.interface';

export function calculateLimitOffset(pageEvent?: PageEvent) {
    let limit = pageEvent ? pageEvent.pageSize : 10;
    let offset = pageEvent ? limit * pageEvent.pageIndex : 0;
    return { limit: limit, offset: offset }
}


