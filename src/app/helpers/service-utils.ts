import { PageEvent } from "@angular/material/paginator";

export default class ServiceUtils {
    static calculateLimitOffset(pageEvent?: PageEvent) {
        let limit = pageEvent ? pageEvent.pageSize : 10;
        let offset = pageEvent ? limit * pageEvent.pageIndex : 0;
        return {limit:limit,offset:offset}
    }
}
