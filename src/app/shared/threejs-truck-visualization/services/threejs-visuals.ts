import * as THREE from 'three';

/**
 * 3D görünümün PAYLAŞILAN görsel yapı taşları.
 *
 * Hem düzenleme ekranı (threejs-truck-visualization.component) hem de müşteri
 * linkindeki salt-okunur görüntüleyici (public-order-view.component) palet/yük
 * görünümünü ve seçim vurgusunu BURADAN alır — iki ekran aynı görünsün ve bir
 * görsel değişiklik tek yerden yapılsın diye. Buradaki her şey saf fonksiyon ya
 * da kendi kaynağını yöneten küçük bir sınıftır; Angular'a bağımlılık yoktur.
 *
 * Birim: milimetre (sahne birimi 1 = 1 mm).
 */

export type BoxSpec = {
  w: number; h: number; d: number; x: number; y: number; z: number; color?: THREE.Color;
};

/** Yük görünümü sabitleri (mm). */
const LOAD_LAYER_PITCH = 105;   // ürün katmanı adımı (yaklaşık; yığına eşit bölünür)
const LOAD_LAYER_GAP = 8;       // katmanlar arası boşluk
const LOAD_INSET = 25;          // katmanların palet kenarından içeri payı
const LOAD_CORNER = 50;         // karton köşe koruma kesiti
const LOAD_CAP = 25;            // üst kapak kalınlığı
const COLOR_WHITE = new THREE.Color(0xffffff);
const COLOR_CORNER = new THREE.Color(0xd9c3a0);

/** Marka rengi (teal) — seçim çerçevesi ve tonu. */
export const HIGHLIGHT_COLOR = 0x0d5c52;

/** Kutu listesini tek bir BufferGeometry'de birleştirir. `color` verilen kutular vertex color alır. */
export function mergeBoxes(boxes: BoxSpec[]): THREE.BufferGeometry {
  const colors: number[] = [];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    g.translate(b.x, b.y, b.z);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const t = g.getAttribute('uv');
    const ix = g.getIndex()!;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(t.getX(i), t.getY(i));
      if (b.color) colors.push(b.color.r, b.color.g, b.color.b);
    }
    for (let i = 0; i < ix.count; i++) indices.push(ix.getX(i) + offset);
    offset += p.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colors.length === positions.length) {
    merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  merged.setIndex(indices);
  return merged;
}

/** Verilen ölçüde kutunun kenar çizgisi geometrisi. */
export function boxEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const box = new THREE.BoxGeometry(w, h, d);
  const edges = new THREE.EdgesGeometry(box);
  box.dispose();
  return edges;
}

/** Ahşap paletin yüksekliği — buildPalletGeometries ile AYNI formül. */
export function getPalletHeight(pkgLength: number, pkgWidth: number): number {
  const boardThick = Math.max(18, pkgWidth * 0.018);
  const blockH = Math.max(70, pkgLength * 0.045);
  return boardThick * 2 + blockH;
}

/**
 * Ahşap palet: açık/koyu tahta olarak 2 birleşik geometri (üst tahtalar, 3×3 blok,
 * alt kızaklar). Origin palet tabanının köşesi (0,0,0); üst yüzey y = height.
 * Dönen geometriler `userData.shared = true` işaretlidir (önbelleklenip paylaşılır).
 */
export function buildPalletGeometries(
  pkgLength: number,
  pkgWidth: number
): { light: THREE.BufferGeometry; dark: THREE.BufferGeometry; height: number } {
  const BOARD_THICK = Math.max(18, pkgWidth * 0.018);
  const BLOCK_H = Math.max(70, pkgLength * 0.045);
  const PALLET_H = BOARD_THICK * 2 + BLOCK_H;
  const BOARD_GAP = pkgWidth * 0.03;
  const BOARD_COUNT = 7;
  const BLOCK_W = Math.min(pkgLength * 0.10, 120);

  const light: BoxSpec[] = [];
  const dark: BoxSpec[] = [];

  // 1) Üst tahtalar: 7 adet, length boyunca
  const boardDepth = (pkgWidth - BOARD_GAP * (BOARD_COUNT - 1)) / BOARD_COUNT;
  const topY = PALLET_H - BOARD_THICK / 2;
  for (let i = 0; i < BOARD_COUNT; i++) {
    (i % 2 === 0 ? light : dark).push({
      w: pkgLength, h: BOARD_THICK, d: boardDepth,
      x: pkgLength / 2, y: topY, z: boardDepth / 2 + i * (boardDepth + BOARD_GAP),
    });
  }

  // 2) Orta destek blokları: 3×3
  const blockX = [pkgLength * 0.12, pkgLength * 0.50, pkgLength * 0.88];
  const blockZ = [pkgWidth * 0.12, pkgWidth * 0.50, pkgWidth * 0.88];
  for (const bx of blockX) {
    for (const bz of blockZ) {
      dark.push({ w: BLOCK_W, h: BLOCK_H, d: BLOCK_W, x: bx, y: BOARD_THICK + BLOCK_H / 2, z: bz });
    }
  }

  // 3) Alt kızaklar: 3 adet
  for (const rz of blockZ) {
    light.push({ w: pkgLength, h: BOARD_THICK, d: BLOCK_W * 1.1, x: pkgLength / 2, y: BOARD_THICK / 2, z: rz });
  }

  const lightGeo = mergeBoxes(light);
  const darkGeo = mergeBoxes(dark);
  lightGeo.userData['shared'] = true;
  darkGeo.userData['shared'] = true;
  return { light: lightGeo, dark: darkGeo, height: PALLET_H };
}

/**
 * Palet üstündeki YÜK'ün geometrisi — merkezi (0,0,0), zarfı length × height × width
 * (düz kutuyla aynı dış ölçü; seçim/çarpışma/etiket mantığı etkilenmez). Parçalar:
 *  - ürün katmanları: kenarlardan içeride, aralarında boşluk; renk palet renginin
 *    beyazla karışımı, sırayla %62 / %50 → yandan çizgili görünür
 *  - 4 köşede karton köşe koruma
 *  - üstte ince kapak (palet renginin %72 tonu)
 * Renkler vertex color'dır: materyal `vertexColors: true` ve beyaz olmalı
 * (bkz. createLoadMaterial).
 */
export function buildLoadGeometry(
  length: number, height: number, width: number, colorHex: string | number
): THREE.BufferGeometry {
  const base = new THREE.Color(colorHex as THREE.ColorRepresentation);
  const tone = (k: number) => COLOR_WHITE.clone().lerp(base, k);

  // Çok alçak/küçük yük: tek parça
  if (height < 80 || length < 150 || width < 150) {
    return mergeBoxes([{ w: length, h: Math.max(height, 1), d: width, x: 0, y: 0, z: 0, color: tone(0.62) }]);
  }

  const inset = Math.min(LOAD_INSET, length * 0.04, width * 0.04);
  const stackH = height - LOAD_CAP - 5;                 // kapak altındaki yığın
  const layers = Math.max(1, Math.round(stackH / LOAD_LAYER_PITCH));
  const pitch = stackH / layers;
  const gap = Math.min(LOAD_LAYER_GAP, pitch * 0.12);
  const bottom = -height / 2;

  const boxes: BoxSpec[] = [];
  const toneA = tone(0.62), toneB = tone(0.5);
  for (let k = 0; k < layers; k++) {
    boxes.push({
      w: length - 2 * inset, h: pitch - gap, d: width - 2 * inset,
      x: 0, y: bottom + k * pitch + pitch / 2, z: 0,
      color: k % 2 ? toneB : toneA,
    });
  }

  const c = Math.min(LOAD_CORNER, length * 0.08, width * 0.08);
  const cx = length / 2 - c / 2, cz = width / 2 - c / 2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => boxes.push({
    w: c, h: stackH, d: c, x: a * cx, y: bottom + stackH / 2, z: b * cz, color: COLOR_CORNER,
  }));

  boxes.push({
    w: length - inset, h: LOAD_CAP, d: width - inset,
    x: 0, y: height / 2 - LOAD_CAP / 2, z: 0, color: tone(0.72),
  });

  return mergeBoxes(boxes);
}

/** Yük gövdesinin materyali (vertex color). `cheap`: düşük kalite profili (Lambert). */
export function createLoadMaterial(cheap: boolean, wireframe = false): THREE.MeshStandardMaterial {
  return cheap
    ? (new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, wireframe }) as unknown as THREE.MeshStandardMaterial)
    : new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0, wireframe });
}

export type HighlightKind = 'selected' | 'multi' | 'hover';

const HIGHLIGHT_NAME: Record<HighlightKind, string> = {
  selected: 'tjsHighlightSelected',
  multi: 'tjsHighlightMulti',
  hover: 'tjsHighlightHover',
};

/**
 * Seçim / çoklu seçim / hover vurgusu. Paket mesh'ine çocuk olarak eklenir
 * (sürükleme ve animasyonda kendiliğinden takip eder):
 *  - 'selected', 'multi': teal çerçeve + yarı saydam teal ton (açık renkli yükte de net görünür)
 *  - 'hover': sadece ince teal çerçeve
 * Geometri/materyaller paylaşılır ve `userData.shared` işaretlidir; mesh dispose
 * edilirken atlanır, `dispose()` ile topluca serbest bırakılır.
 */
export class PackageHighlighter {
  private edges: THREE.BufferGeometry | null = null;
  private box: THREE.BufferGeometry | null = null;
  private lineMats: Record<HighlightKind, THREE.LineBasicMaterial> | null = null;
  private tintMats: Record<'selected' | 'multi', THREE.MeshBasicMaterial> | null = null;

  private ensure(): void {
    if (this.edges) return;
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.box.userData['shared'] = true;
    this.edges = new THREE.EdgesGeometry(this.box);
    this.edges.userData['shared'] = true;

    const line = (opacity: number) => {
      const m = new THREE.LineBasicMaterial({
        color: HIGHLIGHT_COLOR, transparent: opacity < 1, opacity, depthTest: false,
      });
      m.userData['shared'] = true;
      return m;
    };
    const tint = (opacity: number) => {
      const m = new THREE.MeshBasicMaterial({
        color: HIGHLIGHT_COLOR, transparent: true, opacity, depthWrite: false,
      });
      m.userData['shared'] = true;
      return m;
    };
    this.lineMats = { selected: line(1), multi: line(1), hover: line(0.55) };
    this.tintMats = { selected: tint(0.3), multi: tint(0.38) };
  }

  /** Vurguyu takar (varsa yenisiyle değiştirir). Mesh merkezi yük gövdesinin merkezi olmalı. */
  attach(
    mesh: THREE.Object3D,
    dims: { length: number; width: number; height: number },
    kind: HighlightKind
  ): void {
    this.ensure();
    this.detach(mesh, kind);

    const group = new THREE.Group();
    group.name = HIGHLIGHT_NAME[kind];
    // Vurgu paletin TAMAMINI (ahşap taban dahil) sarar
    const palletH = getPalletHeight(dims.length, dims.width);
    const pad = kind === 'hover' ? 12 : 20;
    group.scale.set(dims.length + pad, dims.height + pad, dims.width + pad);
    group.position.set(0, -palletH / 2, 0);

    const noRaycast = () => { /* seçim ışınını etkilemesin */ };

    if (kind !== 'hover') {
      const tintMesh = new THREE.Mesh(this.box!, this.tintMats![kind]);
      tintMesh.raycast = noRaycast;
      tintMesh.renderOrder = 9;
      group.add(tintMesh);
    }
    const lines = new THREE.LineSegments(this.edges!, this.lineMats![kind]);
    lines.raycast = noRaycast;
    lines.renderOrder = 10;
    group.add(lines);

    mesh.add(group);
  }

  detach(mesh: THREE.Object3D | null | undefined, kind: HighlightKind): void {
    if (!mesh) return;
    const existing = mesh.getObjectByName(HIGHLIGHT_NAME[kind]);
    if (existing) existing.parent?.remove(existing);
  }

  dispose(): void {
    this.edges?.dispose();
    this.box?.dispose();
    if (this.lineMats) Object.values(this.lineMats).forEach(m => m.dispose());
    if (this.tintMats) Object.values(this.tintMats).forEach(m => m.dispose());
    this.edges = this.box = null;
    this.lineMats = null;
    this.tintMats = null;
  }
}

/** easeOutCubic */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Kamera görünüm geçişi: hedef etrafında küresel koordinatta, en kısa açıyla,
 * yumuşakça. `tick` her karede çağrılır; geçiş sürerken true döner.
 */
export class CameraTransition {
  private state: {
    from: THREE.Spherical; to: THREE.Spherical;
    fromTarget: THREE.Vector3; toTarget: THREE.Vector3;
    t0: number; dur: number;
  } | null = null;

  get active(): boolean { return this.state !== null; }

  start(camera: THREE.Camera, target: THREE.Vector3, endPos: THREE.Vector3, endTarget: THREE.Vector3, dur = 520): void {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    const to = new THREE.Spherical().setFromVector3(endPos.clone().sub(endTarget));
    // Fazladan tur atmasın: hedef açıyı mevcut açıya en yakın tura taşı
    to.theta += 2 * Math.PI * Math.round((from.theta - to.theta) / (2 * Math.PI));
    this.state = { from, to, fromTarget: target.clone(), toTarget: endTarget.clone(), t0: performance.now(), dur };
  }

  cancel(): void { this.state = null; }

  /** `target` yerinde güncellenir. */
  tick(now: number, camera: THREE.Camera, target: THREE.Vector3): boolean {
    const a = this.state;
    if (!a) return false;
    const t = Math.min(1, (now - a.t0) / a.dur);
    const k = easeOutCubic(t);
    const sph = new THREE.Spherical(
      a.from.radius + (a.to.radius - a.from.radius) * k,
      a.from.phi + (a.to.phi - a.from.phi) * k,
      a.from.theta + (a.to.theta - a.from.theta) * k
    ).makeSafe();
    target.lerpVectors(a.fromTarget, a.toTarget, k);
    camera.position.setFromSpherical(sph).add(target);
    camera.lookAt(target);
    if (t >= 1) this.state = null;
    return true;
  }
}

/**
 * Yükleme animasyonu: paletler arka kapıdan (x = startX) sırayla içeri kayar,
 * sonra yerine iner. Sadece mesh konumunu yazar; paket verisi değişmez.
 * `resolve(id)` her karede güncel mesh + nihai konumu verir (mesh yeniden
 * kurulsa bile çalışır).
 */
export class LoadAnimation {
  static readonly DURATION = 950;
  private state: { ids: string[]; t0: number; stagger: number; startX: number } | null = null;
  private readonly tmp = new THREE.Vector3();

  get active(): boolean { return this.state !== null; }

  start(ids: string[], startX: number): void {
    if (ids.length === 0) return;
    this.state = {
      ids,
      t0: performance.now() + 200,
      // Çok paletli siparişte toplam süre ~6 sn'yi geçmesin
      stagger: Math.min(260, 6000 / ids.length),
      startX,
    };
  }

  /** Sürerken true döner. */
  tick(
    now: number,
    resolve: (id: string, out: THREE.Vector3) => THREE.Object3D | null | undefined
  ): boolean {
    const a = this.state;
    if (!a) return false;
    let busy = false;

    a.ids.forEach((id, i) => {
      let t = (now - a.t0 - i * a.stagger) / LoadAnimation.DURATION;
      if (t < 1) busy = true;
      const mesh = resolve(id, this.tmp);
      if (!mesh) return;
      if (t <= 0) { mesh.visible = false; return; }
      t = Math.min(t, 1);
      const slide = Math.min(t / 0.78, 1);
      const drop = Math.max((t - 0.78) / 0.22, 0);
      mesh.visible = true;
      mesh.position.set(
        a.startX + (this.tmp.x - a.startX) * easeOutCubic(slide),
        this.tmp.y + 160 * (1 - easeOutCubic(drop)),
        this.tmp.z
      );
    });

    if (!busy) this.state = null;
    return true;
  }

  /** Anında bitir: tüm paletler yerinde ve görünür. */
  finish(resolve: (id: string, out: THREE.Vector3) => THREE.Object3D | null | undefined): void {
    const a = this.state;
    if (!a) return;
    this.state = null;
    a.ids.forEach(id => {
      const mesh = resolve(id, this.tmp);
      if (!mesh) return;
      mesh.visible = true;
      mesh.position.copy(this.tmp);
    });
  }

  cancel(): void { this.state = null; }
}

/** Paketin (x,y,z veri koordinatı) mesh merkez konumu — yük gövdesinin merkezi. */
export function packageMeshPosition(
  pkg: { x: number; y: number; z: number; length: number; width: number; height: number },
  out: THREE.Vector3
): THREE.Vector3 {
  const palletH = getPalletHeight(pkg.length, pkg.width);
  return out.set(
    pkg.x + pkg.length / 2,
    pkg.z + palletH + (pkg.height - palletH) / 2,
    pkg.y + pkg.width / 2
  );
}
