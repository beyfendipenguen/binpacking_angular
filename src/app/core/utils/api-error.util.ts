/**
 * Backend hata yanıtlarından kullanıcıya gösterilecek mesajı çıkarır.
 *
 * Desteklenen şekiller (öncelik sırasıyla):
 * 1. Merkezi handler şekli: { status, status_code, type, message, code, errors[] }
 * 2. Eski şekil:           { error: "mesaj" }  (geçiş dönemi alias'ı dahil)
 * 3. DRF field hataları:   { alan_adi: ["mesaj"] }  (handler'a girmeyen view'lar)
 * 4. Düz string body veya JS Error.message
 *
 * Kullanım: getApiErrorMessage(err, fallbackMesaj)
 */

export interface BackendErrorItem {
  field?: string;
  message: string;
  code?: string;
}

export interface BackendErrorBody {
  status?: string;
  status_code?: number;
  type?: string;
  message?: string;
  code?: string;
  errors?: BackendErrorItem[];
  /** Geçiş dönemi alias'ı — frontend tamamen message'a geçince kalkacak */
  error?: string;
}

/** Merkezi şekildeki gövdeyi döner; uymuyorsa null. */
export function getApiErrorBody(err: unknown): BackendErrorBody | null {
  const body = (err as any)?.error;
  if (body && typeof body === 'object' && typeof body.status_code === 'number') {
    return body as BackendErrorBody;
  }
  return null;
}

/** Belirli bir alanın hata mesajını döner (merkezi errors[] veya DRF dict). */
export function getApiFieldError(err: unknown, field: string): string | null {
  const body = (err as any)?.error;
  if (!body || typeof body !== 'object') return null;

  if (Array.isArray(body.errors)) {
    const hit = body.errors.find((e: any) => e?.field === field && e?.message);
    if (hit) return String(hit.message);
  }

  const direct = (body as any)[field];
  if (Array.isArray(direct) && direct.length) return String(direct[0]);
  if (typeof direct === 'string' && direct) return direct;

  return null;
}

/** Kullanıcıya gösterilecek tek hata mesajı. */
export function getApiErrorMessage(err: unknown, fallback = ''): string {
  if (!err) return fallback;
  const anyErr = err as any;
  const body = anyErr?.error ?? anyErr;

  if (typeof body === 'string' && body.trim()) return body;

  if (body && typeof body === 'object') {
    // 1. Merkezi şekil
    if (typeof body.message === 'string' && body.message) return body.message;
    // 2. Eski şekil / alias
    if (typeof body.error === 'string' && body.error) return body.error;
    // 3. Merkezi errors[] listesi
    if (Array.isArray(body.errors) && body.errors.length && body.errors[0]?.message) {
      return String(body.errors[0].message);
    }
    // 4. DRF detail
    if (typeof body.detail === 'string' && body.detail) return body.detail;
    // 5. DRF field hataları: ilk alanın ilk mesajı
    for (const [key, val] of Object.entries(body)) {
      if (key === 'status' || key === 'type' || key === 'code') continue;
      if (Array.isArray(val) && val.length && typeof val[0] === 'string') return val[0];
    }
  }

  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message;
  return fallback;
}
