import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { QualityProfile, getQualityProfile } from './threejs-quality';

export interface ThreeJSConfig {
  containerElement: HTMLElement;
  truckDimensions: [number, number, number];
  enableShadows?: boolean;
  pixelRatio?: number;
}

export interface ThreeJSComponents {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  truckGroup: THREE.Group;
  packagesGroup: THREE.Group;
  platformMesh?: THREE.Mesh;
  /** Sadece gölge düşen zemin (ShadowMaterial); gölgeler kapalıysa yok. */
  groundMesh?: THREE.Mesh;
}

/** Yük tabanının (deck üst yüzeyi) yerden yüksekliği, mm. */
export const DECK_TOP_Y = 1100;
const DECK_THICKNESS = 120;

/** Kamera görüş açısı (derece). Dar açı → daha az perspektif bozulması. */
export const CAMERA_FOV = 30;
/**
 * Eski FOV 75'teki kadrajı korumak için mesafe çarpanı:
 * tan(75°/2) / tan(30°/2) ≈ 2.864. Görünüm mesafesi = maxDim × VIEW_DISTANCE_FACTOR.
 */
export const VIEW_DISTANCE_FACTOR = 1.5 * (Math.tan((75 * Math.PI) / 360) / Math.tan((CAMERA_FOV * Math.PI) / 360));
/** Mesafeye bağlı hassasiyetleri (pan vb.) eski FOV'daki hisse eşitlemek için. */
export const FOV_SENSITIVITY_SCALE = Math.tan((CAMERA_FOV * Math.PI) / 360) / Math.tan((75 * Math.PI) / 360);

@Injectable({
  providedIn: 'root'
})
export class ThreeJSInitializationService {

  async initialize(config: ThreeJSConfig): Promise<ThreeJSComponents> {
    const quality  = getQualityProfile();
    const shadows  = config.enableShadows !== false && quality.shadows;
    const scene    = new THREE.Scene();   // arka plan şeffaf — gradient CSS'te (.tjs-canvas)
    const camera   = this.createCamera(config.containerElement, config.truckDimensions, quality);
    const renderer = this.createRenderer(config.containerElement, config, quality, shadows);

    this.setupLighting(scene, config.truckDimensions, shadows);

    const truckGroup    = new THREE.Group();
    const packagesGroup = new THREE.Group();
    packagesGroup.position.y = DECK_TOP_Y;

    scene.add(truckGroup);
    scene.add(packagesGroup);

    const platformMesh = this.createVehicle(truckGroup, config.truckDimensions, quality, shadows);
    const groundMesh = shadows
      ? this.createShadowGround(scene, config.truckDimensions)
      : undefined;

    return { scene, camera, renderer, truckGroup, packagesGroup, platformMesh, groundMesh };
  }

  // ---------------------------------------------------------------------------
  // CAMERA
  // ---------------------------------------------------------------------------

  private createCamera(
    container: HTMLElement,
    truckDimensions: [number, number, number],
    quality: QualityProfile
  ): THREE.PerspectiveCamera {
    const width  = container.clientWidth  || 800;
    const height = container.clientHeight || 600;

    const camera  = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, quality.cameraNear, 400000);
    const maxDim  = Math.max(...truckDimensions);
    const dist    = maxDim * VIEW_DISTANCE_FACTOR;
    const cx      = truckDimensions[0] / 2;
    const cy      = truckDimensions[2] / 2;
    const cz      = truckDimensions[1] / 2;

    camera.position.set(cx + dist * 0.4, cy + dist * 0.4, cz + dist * 0.4);
    camera.lookAt(cx, cy, cz);

    return camera;
  }

  // ---------------------------------------------------------------------------
  // RENDERER
  // ---------------------------------------------------------------------------

  private createRenderer(
    container: HTMLElement,
    config: ThreeJSConfig,
    quality: QualityProfile,
    shadows: boolean
  ): THREE.WebGLRenderer {
    const width  = container.clientWidth  || 800;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      antialias:             quality.antialias,
      alpha:                 true,
      powerPreference:       'high-performance',
      logarithmicDepthBuffer: quality.logarithmicDepthBuffer   // ← Z-fighting fix (düşük modda kapalı, near büyütüldü)
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(
      Math.min(config.pixelRatio ?? window.devicePixelRatio, window.devicePixelRatio, quality.maxPixelRatio, 1.75)
    );
    renderer.setClearColor(0x000000, 0);   // şeffaf: arka plan CSS gradient
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    if (shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    }

    container.appendChild(renderer.domElement);

    return renderer;
  }

  // ---------------------------------------------------------------------------
  // LIGHTING — yumuşak gökyüzü ışığı + tek güneş (gölge). Ortam haritası ve
  // tone mapping yok: renkler palette tanımlandığı gibi, mat ve sakin görünür.
  // ---------------------------------------------------------------------------

  private setupLighting(scene: THREE.Scene, truckDimensions: [number, number, number], shadows: boolean): void {
    const [tl, tw] = truckDimensions;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xaab8b5, 1.7));

    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    const cx = tl / 2, cz = tw / 2;
    sun.target.position.set(cx, DECK_TOP_Y, cz);
    sun.position.set(cx - 5000, 14000, cz + 8000);
    scene.add(sun.target);

    sun.castShadow = shadows;
    if (shadows) {
      // Gölge kamerası aracı + yandaki bekleme alanını (plate) kapsar
      const half = Math.max(tl * 0.75, 6000);
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near   = 100;
      sun.shadow.camera.far    = 45000;
      sun.shadow.camera.left   = -half;
      sun.shadow.camera.right  =  half;
      sun.shadow.camera.top    =  half;
      sun.shadow.camera.bottom = -half;
      sun.shadow.bias          = -0.0005;
      sun.shadow.normalBias    = 15;   // katman yan yüzlerinde gölge çizgilenmesini önler
    }
    scene.add(sun);
  }

  // ---------------------------------------------------------------------------
  // ZEMİN — dolu plaka yok; sadece gölge düşer (ShadowMaterial)
  // ---------------------------------------------------------------------------

  private createShadowGround(
    scene: THREE.Scene,
    truckDimensions: [number, number, number]
  ): THREE.Mesh {
    const [tl, tw] = truckDimensions;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(tl * 6, tl * 4),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(tl / 2, 0, tw / 2);
    ground.receiveShadow = true;
    ground.name = 'groundShadow';
    scene.add(ground);
    return ground;
  }

  // ---------------------------------------------------------------------------
  // ARAÇ — sade, kod ile çizilen model (GLTF yok): taban (deck), şasi kirişleri,
  // tekerlekler, ön ayaklar; kasa = kenar çizgileri + ön duvarda hafif panel.
  // Her araç tipi (tır, konteyner) aynı şasi üzerinde çizilir.
  // ---------------------------------------------------------------------------

  private createVehicle(
    truckGroup: THREE.Group,
    truckDimensions: [number, number, number],
    quality: QualityProfile,
    shadows: boolean
  ): THREE.Mesh {
    const [tl, tw, th] = truckDimensions;
    const mat = (color: number, roughness = 0.75): THREE.Material =>
      quality.cheapMaterials
        ? new THREE.MeshLambertMaterial({ color })
        : new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      m.castShadow = shadows && cast;
      m.receiveShadow = shadows;
      truckGroup.add(m);
      return m;
    };

    // Taban (deck)
    const deck = add(
      new THREE.BoxGeometry(tl, DECK_THICKNESS, tw + 40),
      mat(0xc3cbca, 0.8),
      tl / 2, DECK_TOP_Y - DECK_THICKNESS / 2, tw / 2
    );

    {
      const dark = mat(0x4a5554, 0.8);
      const deckBottom = DECK_TOP_Y - DECK_THICKNESS;

      // Şasi: iki kiriş
      const beamH = 340;
      const beamGeo = new THREE.BoxGeometry(tl * 0.94, beamH, 140);
      [-550, 550].forEach(dz => add(beamGeo, dark, tl / 2, deckBottom - beamH / 2, tw / 2 + dz));

      // Tekerlekler: arkada (kapı tarafı, x = tl) aks grubu, çift taraf.
      // Lastik dış yüzü kasa yan yüzüyle hizalı; açık renkli jant, koyu şasi/gölge
      // içinde tekerleğin "tekerlek" olarak okunmasını sağlar. Çamurluk üstten
      // bakışta da aks grubunu belli eder.
      const segs = quality.level === 'low' ? 18 : 32;
      // Lastik tepesi tabanın ALTINDA kalmalı (taban altı = 980): tabanla kesişirse
      // ya da üst yüzeyiyle aynı düzleme gelirse platformun üstünden siyah görünür.
      const TYRE_R = 465, TYRE_W = 300;
      const tyreMat = mat(0x262b2a, 0.95);
      const rimMat = mat(0xb4bebc, 0.6);
      const tyreGeo = new THREE.CylinderGeometry(TYRE_R, TYRE_R, TYRE_W, segs);
      tyreGeo.rotateX(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(TYRE_R * 0.58, TYRE_R * 0.58, TYRE_W + 16, segs);
      rimGeo.rotateX(Math.PI / 2);
      const hubGeo = new THREE.CylinderGeometry(TYRE_R * 0.2, TYRE_R * 0.2, TYRE_W + 40, 16);
      hubGeo.rotateX(Math.PI / 2);
      const axleGeo = new THREE.CylinderGeometry(70, 70, tw - TYRE_W, 12);
      axleGeo.rotateX(Math.PI / 2);

      const axleCount = tl >= 9000 ? 3 : tl >= 5000 ? 2 : 1;
      const AXLE_PITCH = 1310;
      const firstAxleX = tl - Math.min(1500, tl * 0.18);
      for (let i = 0; i < axleCount; i++) {
        const x = firstAxleX - i * AXLE_PITCH;
        add(axleGeo, dark, x, TYRE_R, tw / 2, false);
        [TYRE_W / 2, tw - TYRE_W / 2].forEach(z => {
          add(tyreGeo, tyreMat, x, TYRE_R, z);
          add(rimGeo, rimMat, x, TYRE_R, z, false);
          add(hubGeo, dark, x, TYRE_R, z, false);
        });
      }

      // Çamurluk: aks grubunun üstünde, kasa kenarından hafif taşan ince şerit
      const groupLen = (axleCount - 1) * AXLE_PITCH + TYRE_R * 2 + 240;
      const groupCx = firstAxleX - ((axleCount - 1) * AXLE_PITCH) / 2;
      const GUARD_H = 24;
      const guardGeo = new THREE.BoxGeometry(groupLen, GUARD_H, TYRE_W + 60);
      const guardY = deckBottom - 4 - GUARD_H / 2;   // tabanın hemen altında, lastiğin üstünde
      [TYRE_W / 2 - 30, tw - TYRE_W / 2 + 30].forEach(z =>
        add(guardGeo, dark, groupCx, guardY, z, false));

      // Arka tampon
      add(new THREE.BoxGeometry(120, 140, tw), dark, tl - 60, deckBottom - 260, tw / 2, false);

      // Ön ayaklar (römork park ayağı)
      const legH = deckBottom;
      const legGeo = new THREE.BoxGeometry(120, legH, 120);
      const legX = Math.min(2000, tl * 0.2);
      [-600, 600].forEach(dz => add(legGeo, dark, legX, legH / 2, tw / 2 + dz));
    }

    // Kasa: dolu duvar yok — sadece kenar çizgileri
    const bodyH = th + 150;
    const bodyGeo = new THREE.BoxGeometry(tl, bodyH, tw);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(bodyGeo),
      new THREE.LineBasicMaterial({ color: 0x6f9e97, transparent: true, opacity: 0.7 })
    );
    bodyGeo.dispose();
    edges.position.set(tl / 2, DECK_TOP_Y + bodyH / 2, tw / 2);
    truckGroup.add(edges);

    // Ön duvar (x = 0): çok hafif şeffaf panel — yön duygusu verir
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, bodyH),
      new THREE.MeshBasicMaterial({
        color: 0x0d5c52, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide
      })
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(0, DECK_TOP_Y + bodyH / 2, tw / 2);
    truckGroup.add(glass);

    return deck;
  }

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  cleanup(components: Partial<ThreeJSComponents>): void {
    if (components.renderer) {
      components.renderer.dispose();
      components.renderer.domElement.parentNode?.removeChild(
        components.renderer.domElement
      );
    }

    if (components.scene) {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      components.scene.traverse(obj => {
        const o = obj as THREE.Mesh;   // Mesh / LineSegments / Sprite
        if (o.geometry) geometries.add(o.geometry);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && materials.add(m));
      });
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      components.scene.clear();
    }
  }
}
