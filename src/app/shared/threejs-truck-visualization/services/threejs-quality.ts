// 3D görünüm kalite profili — cihaz gücüne göre otomatik seçilir.
//
// Amaç: 8 GB ve altı RAM / entegre ekran kartlı bilgisayarlarda akıcılık.
// "auto" modda cihaz algılanır; kullanıcı tarayıcı konsolundan ya da
// localStorage('threejsQuality') = 'low' | 'high' | 'auto' ile elle
// zorlayabilir.

export type QualityLevel = 'low' | 'high';

export interface QualityProfile {
  level: QualityLevel;
  /** Kenar yumuşatma (MSAA) */
  antialias: boolean;
  /** Üst sınır piksel oranı (Retina/yüksek DPI ekranlarda GPU yükünü belirler) */
  maxPixelRatio: number;
  /** Gölge haritası kullanılsın mı */
  shadows: boolean;
  /** Logaritmik derinlik tamponu (z-fighting çözümü; bazı GPU'larda early-Z'yi kapatır) */
  logarithmicDepthBuffer: boolean;
  /** Kamera yakın düzlem (log depth kapalıyken z-fighting için büyütülür) */
  cameraNear: number;
  /** Ürün detay etiketi canvas'ının en büyük kenarı (px) */
  detailLabelMaxRes: number;
  /** Etiket texture'larında mipmap/anisotropy kullanılsın mı */
  richTextures: boolean;
  /** Paket gövdesi için ucuz (Lambert) materyal */
  cheapMaterials: boolean;
}

export const HIGH_QUALITY: QualityProfile = {
  level: 'high',
  antialias: true,
  maxPixelRatio: 2,
  shadows: true,
  logarithmicDepthBuffer: true,
  cameraNear: 0.1,
  detailLabelMaxRes: 1024,
  richTextures: true,
  cheapMaterials: false,
};

export const LOW_QUALITY: QualityProfile = {
  level: 'low',
  antialias: false,
  maxPixelRatio: 1,
  shadows: false,
  logarithmicDepthBuffer: false,
  cameraNear: 50,
  detailLabelMaxRes: 512,
  richTextures: false,
  cheapMaterials: true,
};

const STORAGE_KEY = 'threejsQuality';

let cached: QualityProfile | null = null;

/** GPU adını (varsa) döner; yazılım render'ı ve entegre GPU tespiti için. */
function gpuRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Cihaz puanı: ≥2 ise düşük kalite.
 *  - deviceMemory ≤ 4 GB (tarayıcılar en çok 8 raporlar; <8 = 8 GB altı) → +2
 *  - ≤ 4 mantıksal çekirdek → +1
 *  - yazılım render'ı (SwiftShader/llvmpipe/Basic Render) → +2
 *  - Intel entegre GPU (UHD/HD/Iris) → +1
 */
function detectProfile(): QualityProfile {
  let forced: string | null = null;
  try {
    forced = localStorage.getItem(STORAGE_KEY);
  } catch { /* storage yok */ }
  if (forced === 'low') return LOW_QUALITY;
  if (forced === 'high') return HIGH_QUALITY;

  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory;           // Chrome/Edge; Firefox/Safari'de yok
  const cores = nav.hardwareConcurrency || 8;
  const gpu = gpuRenderer();

  let score = 0;
  if (typeof memory === 'number' && memory <= 4) score += 2;
  if (cores <= 4) score += 1;
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) score += 2;
  if (/intel/.test(gpu) && /(uhd|hd graphics|iris)/.test(gpu)) score += 1;

  return score >= 2 ? LOW_QUALITY : HIGH_QUALITY;
}

/** Oturum boyunca bir kez hesaplanır. */
export function getQualityProfile(): QualityProfile {
  if (!cached) cached = detectProfile();
  return cached;
}
