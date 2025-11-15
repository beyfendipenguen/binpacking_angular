import { OrderDetail } from "../models/order-detail.interface";

export function areOrderDetailsEqual(a: OrderDetail[], b: OrderDetail[]): boolean {
    if (a.length !== b.length) return false;

    const sortById = (list: OrderDetail[]) =>
        [...list].sort((x, y) => x.id.localeCompare(y.id));

    const sa = sortById(a);
    const sb = sortById(b);

    return sa.every((x, i) => deepEqual(x, sb[i]));

}


export function deepEqual(a: any, b: any): boolean {
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
        return a === b;
    }

    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(key => deepEqual(a[key], b[key]));
}