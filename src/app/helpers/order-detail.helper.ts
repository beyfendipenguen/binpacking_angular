import { OrderDetailRead } from "../models/order-detail.interface";

export function areOrderDetailsEqual(
  a: OrderDetailRead[],
  b: OrderDetailRead[]
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  // Signature oluştur: "product_id:count"
  const createSignature = (detail: OrderDetailRead): string => {
    const productId = detail.product?.id;
    return `${productId}:${detail.count}`;
  };

  const signaturesA = a.map(createSignature).sort();
  const signaturesB = b.map(createSignature).sort();

  return signaturesA.every((sig, index) => sig === signaturesB[index]);
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
