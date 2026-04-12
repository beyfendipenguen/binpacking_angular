import { Injectable, inject } from '@angular/core';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ThreeJSModelCacheService } from './threejs-model-cache.service';

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
  truckModel?: THREE.Group;
  wheelModel?: THREE.Group;
  platformMesh?: THREE.Mesh;
}

@Injectable({
  providedIn: 'root'
})
export class ThreeJSInitializationService {
  private modelCacheService = inject(ThreeJSModelCacheService);

  async initialize(config: ThreeJSConfig): Promise<ThreeJSComponents> {
    const scene    = this.createScene();
    const camera   = this.createCamera(config.containerElement, config.truckDimensions);
    const renderer = this.createRenderer(config.containerElement, config);

    this.setupLighting(scene, renderer);

    const truckGroup    = new THREE.Group();
    const packagesGroup = new THREE.Group();
    packagesGroup.position.y = 1100;

    scene.add(truckGroup);
    scene.add(packagesGroup);

    const platformMesh = this.createPlatform(config.truckDimensions);
    scene.add(platformMesh);
    this.createGroundPlane(scene);

    const models = await this.modelCacheService.getModels();
    const { wheel: wheelModel } = this.modelCacheService.cloneModels(models);

    this.applyWheelTransforms(wheelModel, config.truckDimensions);
    truckGroup.add(wheelModel);
    this.createTruckWireframe(truckGroup, config.truckDimensions);

    return { scene, camera, renderer, truckGroup, packagesGroup, wheelModel, platformMesh };
  }

  // ---------------------------------------------------------------------------
  // SCENE
  // ---------------------------------------------------------------------------

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();

    const canvas  = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 512;

    const ctx      = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0,   '#e0f2fe');
    gradient.addColorStop(0.5, '#f0f9ff');
    gradient.addColorStop(1,   '#f8fafc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    scene.background = new THREE.CanvasTexture(canvas);

    return scene;
  }

  // ---------------------------------------------------------------------------
  // CAMERA
  // ---------------------------------------------------------------------------

  private createCamera(
    container: HTMLElement,
    truckDimensions: [number, number, number]
  ): THREE.PerspectiveCamera {
    const width  = container.clientWidth  || 800;
    const height = container.clientHeight || 600;

    const camera  = new THREE.PerspectiveCamera(75, width / height, 0.1, 100000);
    const maxDim  = Math.max(...truckDimensions);
    const dist    = maxDim * 1.5;
    const cx      = truckDimensions[0] / 2;
    const cy      = truckDimensions[2] / 2;
    const cz      = truckDimensions[1] / 2;

    camera.position.set(cx + dist * 0.4, cy + dist * 0.4, cz + dist * 0.4);
    camera.lookAt(cx, cy, cz);

    return camera;
  }

  // ---------------------------------------------------------------------------
  // RENDERER
  // ① logarithmicDepthBuffer  → Z-fighting / yanıp sönme biter
  // ② toneMapping + exposure  → renklerin daha canlı görünmesi
  // ---------------------------------------------------------------------------

  private createRenderer(container: HTMLElement, config: ThreeJSConfig): THREE.WebGLRenderer {
    const width  = container.clientWidth  || 800;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      antialias:             true,
      alpha:                 true,
      powerPreference:       'high-performance',
      logarithmicDepthBuffer: true   // ← Z-fighting fix
    });

    renderer.setSize(width, height);   // false → CSS'e dokunma
    renderer.setPixelRatio(Math.min(config.pixelRatio ?? window.devicePixelRatio, 2));

    // Tone mapping — renkleri gerçekçi kılar
    renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace    = THREE.SRGBColorSpace;

    if (config.enableShadows !== false) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    }

    container.appendChild(renderer.domElement);

    return renderer;
  }

  // ---------------------------------------------------------------------------
  // LIGHTING
  // Eski setup: ambient 0.7 (çok yüksek → flat görünüm)
  // Yeni setup: ambient 0.3 + güçlü directional + hemisphere + RoomEnvironment
  // RoomEnvironment tek satır — MeshStandardMaterial ile birleşince dramatik fark
  // ---------------------------------------------------------------------------

  private setupLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
    // 1. Ambient — düşük tut, aksi halde gölgeler yok olur
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    // 2. Ana güneş ışığı
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(5000, 8000, 3000);
    sun.castShadow               = true;
    sun.shadow.mapSize.width     = 2048;
    sun.shadow.mapSize.height    = 2048;
    sun.shadow.camera.near       = 1;
    sun.shadow.camera.far        = 20000;
    sun.shadow.camera.left       = -8000;
    sun.shadow.camera.right      =  8000;
    sun.shadow.camera.top        =  8000;
    sun.shadow.camera.bottom     = -8000;
    sun.shadow.bias              = -0.0005;
    scene.add(sun);

    // 3. Fill ışığı — karanlık yüzeyleri yumuşatır
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-3000, 4000, -2000);
    scene.add(fill);

    // 4. Rim ışığı — kenarlara derinlik verir
    const rim = new THREE.DirectionalLight(0xc8e8ff, 0.3);
    rim.position.set(-2000, 3000, 5000);
    scene.add(rim);

    // 5. Hemisphere — üstten gökyüzü rengi, alttan zemin rengi
    //    MeshLambertMaterial bunu kullanamaz, MeshStandardMaterial kullanır
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.5));

    // 6. RoomEnvironment — IBL (image-based lighting)
    //    MeshStandardMaterial'ın roughness/metalness'ını gerçekçi yansıtır
    //    Bu + MeshStandardMaterial = plastik görünümün sonu
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    pmrem.dispose();
  }

  // ---------------------------------------------------------------------------
  // GROUND & PLATFORM
  // ---------------------------------------------------------------------------

  private createGroundPlane(scene: THREE.Scene): void {
    const geo = new THREE.PlaneGeometry(300000, 300000);
    const mat = new THREE.MeshStandardMaterial({
      color:     0xf5f5f5,
      metalness: 0,
      roughness: 0.8,
      side:      THREE.DoubleSide
    });

    const ground      = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -200;
    ground.receiveShadow = true;

    scene.add(ground);
  }

  private createPlatform(truckDimensions: [number, number, number]): THREE.Mesh {
    const [tl, tw] = truckDimensions;
    const pH       = 200;

    const geo = new THREE.BoxGeometry(tl, pH, tw);
    const mat = new THREE.MeshStandardMaterial({
      color:     0x808080,
      metalness: 0.3,
      roughness: 0.7
    });

    const mesh      = new THREE.Mesh(geo, mat);
    mesh.position.set(tl / 2, 1100 - pH / 2, tw / 2);
    mesh.receiveShadow = true;

    return mesh;
  }

  // ---------------------------------------------------------------------------
  // TRUCK WIREFRAME
  // ---------------------------------------------------------------------------

  private createTruckWireframe(
    truckGroup: THREE.Group,
    truckDimensions: [number, number, number]
  ): void {
    const [tl, tw, th ] = truckDimensions;

    const geo       = new THREE.BoxGeometry(tl, th + 150, tw);
    const edges     = new THREE.EdgesGeometry(geo);
    const mat       = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, mat);

    wireframe.position.set(tl / 2, (th + 150) / 2 + 1100, tw / 2);
    truckGroup.add(wireframe);
  }

  // ---------------------------------------------------------------------------
  // MODEL TRANSFORMS
  // ---------------------------------------------------------------------------

  private applyWheelTransforms(
    wheelModel: THREE.Group,
    truckDimensions: [number, number, number]
  ): void {
    const box   = new THREE.Box3().setFromObject(wheelModel);
    const size  = box.getSize(new THREE.Vector3());
    const scale = Math.min(
      truckDimensions[0] / size.x,
      truckDimensions[2] / size.y,
      truckDimensions[1] / size.z
    );

    wheelModel.scale.setScalar(scale);
    wheelModel.rotation.y = Math.PI / 2;
    wheelModel.position.set(truckDimensions[0] / 2, 0, truckDimensions[1] / 2);

    wheelModel.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });
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
      components.scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(m => m?.dispose());
        }
      });
      components.scene.clear();
    }
  }
}
