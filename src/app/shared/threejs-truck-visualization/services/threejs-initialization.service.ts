import { Injectable, inject } from '@angular/core';
import * as THREE from 'three';
import { ThreeJSModelCacheService } from './threejs-model-cache.service';

/**
 * Three.js Initialization Service
 *
 * Görevler:
 * - Scene, camera, renderer setup
 * - Lighting configuration
 * - Platform ve ground plane oluşturma
 * - Model transform'ları
 */

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

  private readonly minCameraPhi = Math.PI / 6;
  private readonly maxCameraPhi = Math.PI / 2.2;

  /**
   * Initialize complete Three.js environment
   */
  async initialize(config: ThreeJSConfig): Promise<ThreeJSComponents> {

    // 1. Basic components
    const scene = this.createScene();
    const camera = this.createCamera(config.containerElement, config.truckDimensions);
    const renderer = this.createRenderer(config.containerElement, config);

    // 2. Lighting
    this.setupLighting(scene);

    // 3. Groups
    const truckGroup = new THREE.Group();
    const packagesGroup = new THREE.Group();
    packagesGroup.position.y = 1100;

    scene.add(truckGroup);
    scene.add(packagesGroup);

    // 4. Platform and ground
    const platformMesh = this.createPlatform(config.truckDimensions);
    scene.add(platformMesh);

    this.createGroundPlane(scene);

    // 5. Load models from cache
    const models = await this.modelCacheService.getModels();
    const {wheel: wheelModel } = this.modelCacheService.cloneModels(models);

    // 6. Apply transforms
    // this.applyTruckTransforms(truckModel, config.truckDimensions);
    this.applyWheelTransforms(wheelModel, config.truckDimensions);

    // 7. Add to scene
    // truckGroup.add(truckModel);
    truckGroup.add(wheelModel);

    // 8. Create wireframe for truck container
    this.createTruckWireframe(truckGroup, config.truckDimensions);

    return {
      scene,
      camera,
      renderer,
      truckGroup,
      packagesGroup,
      // truckModel,
      wheelModel,
      platformMesh
    };
  }

  /**
   * Create Three.js scene
   */
  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();

    // Gradient background
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 512;
    gradientCanvas.height = 512;

    const context = gradientCanvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#e0f2fe');
    gradient.addColorStop(0.5, '#f0f9ff');
    gradient.addColorStop(1, '#f8fafc');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);

    const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
    scene.background = gradientTexture;

    return scene;
  }

  /**
   * Create camera
   */
  private createCamera(
    container: HTMLElement,
    truckDimensions: [number, number, number]
  ): THREE.PerspectiveCamera {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100000);

    // Position camera for isometric view
    const maxDim = Math.max(...truckDimensions);
    const distance = maxDim * 1.5;

    const centerX = truckDimensions[0] / 2;
    const centerY = truckDimensions[2] / 2;
    const centerZ = truckDimensions[1] / 2;

    camera.position.set(
      centerX + distance * 0.4,
      centerY + distance * 0.4,
      centerZ + distance * 0.4
    );

    camera.lookAt(centerX, centerY, centerZ);

    return camera;
  }

  /**
   * Create renderer
   */
  private createRenderer(
    container: HTMLElement,
    config: ThreeJSConfig
  ): THREE.WebGLRenderer {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance' // Performance hint
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(config.pixelRatio || window.devicePixelRatio, 2));

    if (config.enableShadows !== false) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    container.appendChild(renderer.domElement);

    return renderer;
  }

  /**
   * Setup lighting
   */
  private setupLighting(scene: THREE.Scene): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5000, 8000, 3000);
    mainLight.castShadow = true;

    // Shadow configuration
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 20000;
    mainLight.shadow.camera.left = -8000;
    mainLight.shadow.camera.right = 8000;
    mainLight.shadow.camera.top = 8000;
    mainLight.shadow.camera.bottom = -8000;
    mainLight.shadow.bias = -0.0005;

    scene.add(mainLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3000, 4000, -2000);
    scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0xadd8e6, 0.2);
    rimLight.position.set(-2000, 3000, 5000);
    scene.add(rimLight);

    // Hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    scene.add(hemiLight);
  }

  /**
   * Create ground plane
   */
  private createGroundPlane(scene: THREE.Scene): void {
    const groundGeometry = new THREE.PlaneGeometry(300000, 300000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      metalness: 0,
      roughness: 0.8,
      side: THREE.DoubleSide
    });

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -200;
    groundMesh.receiveShadow = true;

    scene.add(groundMesh);
  }

  /**
   * Create platform
   */
  private createPlatform(truckDimensions: [number, number, number]): THREE.Mesh {
    const platformLength = truckDimensions[0];
    const platformWidth = truckDimensions[1];
    const platformHeight = 200;

    const geometry = new THREE.BoxGeometry(platformLength, platformHeight, platformWidth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      metalness: 0.3,
      roughness: 0.7,
      side: THREE.DoubleSide
    });

    const platformMesh = new THREE.Mesh(geometry, material);
    platformMesh.position.set(
      truckDimensions[0] / 2,
      1100 - platformHeight / 2,
      truckDimensions[1] / 2
    );

    platformMesh.castShadow = false;
    platformMesh.receiveShadow = true;

    return platformMesh;
  }

  /**
   * Create truck wireframe
   */
  private createTruckWireframe(
    truckGroup: THREE.Group,
    truckDimensions: [number, number, number]
  ): void {
    const geometry = new THREE.BoxGeometry(
      truckDimensions[0],
      truckDimensions[2],
      truckDimensions[1]
    );

    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({
      color: 0x666666,
      linewidth: 2
    });

    const wireframe = new THREE.LineSegments(edges, material);
    wireframe.position.set(
      truckDimensions[0] / 2,
      truckDimensions[2] / 2 + 1100,
      truckDimensions[1] / 2
    );

    truckGroup.add(wireframe);
  }

  /**
   * Apply truck model transforms
   */
  private applyTruckTransforms(
    truckModel: THREE.Group,
    truckDimensions: [number, number, number]
  ): void {
    const box = new THREE.Box3().setFromObject(truckModel);
    const size = box.getSize(new THREE.Vector3());

    const scaleX = truckDimensions[0] / size.x;
    const scaleY = truckDimensions[2] / size.y;
    const scaleZ = truckDimensions[1] / size.z;

    const scale = Math.min(scaleX, scaleY, scaleZ);
    truckModel.scale.setScalar(scale * 2.5);

    truckModel.rotation.y = -Math.PI / 2;
    truckModel.position.set(0, 0, truckDimensions[1] / 2 + 100);

    truckModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Apply wheel model transforms
   */
  private applyWheelTransforms(
    wheelModel: THREE.Group,
    truckDimensions: [number, number, number]
  ): void {
    const box = new THREE.Box3().setFromObject(wheelModel);
    const size = box.getSize(new THREE.Vector3());

    const scaleX = truckDimensions[0] / size.x;
    const scaleY = truckDimensions[2] / size.y;
    const scaleZ = truckDimensions[1] / size.z;

    const scale = Math.min(scaleX, scaleY, scaleZ);
    wheelModel.scale.setScalar(scale);

    wheelModel.rotation.y = Math.PI / 2;
    wheelModel.position.set(
      truckDimensions[0] / 2,
      0,
      truckDimensions[1] / 2
    );

    wheelModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Cleanup Three.js resources
   */
  cleanup(components: Partial<ThreeJSComponents>): void {
    // Dispose renderer
    if (components.renderer) {
      components.renderer.dispose();
      const canvas = components.renderer.domElement;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }

    // Clear scene
    if (components.scene) {
      this.disposeScene(components.scene);
    }
  }

  /**
   * Dispose scene and all its children
   */
  private disposeScene(scene: THREE.Scene): void {
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat?.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    scene.clear();
  }
}
