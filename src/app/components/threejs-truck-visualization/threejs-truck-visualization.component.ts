import {
  Component,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  HostListener,
  inject,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { AppState, cleanUpInvalidPackagesFromOrder, selectStep3IsDirty, selectTruck, setStep3IsDirty } from '../../store';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { CancelConfirmationDialogComponent } from '../cancel-confirmation-dialog/cancel-confirmation-dialog.component';

interface PackageData {
  id: number;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  height: number;
  weight: number;
  color?: string;
  originalColor?: string;
  dimensions?: string;
  mesh?: THREE.Mesh;
  isBeingDragged?: boolean;
  rotation?: number;
  originalLength?: number;
  originalWidth?: number;
}

@Component({
  selector: 'app-threejs-truck-visualization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './threejs-truck-visualization.component.html',
  styleUrl: './threejs-truck-visualization.component.scss',
  changeDetection: ChangeDetectionStrategy.Default
})
export class ThreeJSTruckVisualizationComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('threeContainer', { static: true }) threeContainer!: ElementRef;

  @Input() piecesData: any[] | string = [];
  @Input() showHelp: boolean = true;
  @Input() showWeightDisplay: boolean = true;
  @Input() weightCalculationDepth: number = 3000;

  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);

  private readonly minCameraPhi = Math.PI / 6;
  private readonly maxCameraPhi = Math.PI / 2.2;
  private readonly minCameraHeight = 500;
  truckDimension = this.store.selectSignal(selectTruck)
  // Models
  private gltfLoader!: GLTFLoader;
  private truckModel?: THREE.Group;
  private trailerWheelModel?: THREE.Group;
  private platformMesh?: THREE.Mesh;

  modelsLoaded = {
    truck: false,
    trailerWheel: false
  };

  // UI State
  isLoadingModels = true;
  isLoadingData = false;
  dragModeEnabled = true;
  wireframeMode = false;
  currentView = 'isometric';
  showControls = true;
  showStats = true;
  selectedPackage: PackageData | null = null;
  showCollisionWarning = false;

  // Camera controls
  minZoom = 100;
  maxZoom = 300;
  zoomLevel = 10;
  private cameraTarget = new THREE.Vector3();

  // Performance Stats
  currentFPS = 60;
  triangleCount = 0;
  originalPackageCount = 0;

  // Drag system
  private isDragging = false;
  private draggedPackage: PackageData | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private dragPlane = new THREE.Plane();
  private dragOffset = new THREE.Vector3();
  private dragSensitivity = 0.9;
  private lastDragPosition = new THREE.Vector3();

  // Three.js Objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  // Groups
  private truckGroup!: THREE.Group;
  private packagesGroup!: THREE.Group;

  // Camera controls
  private isRotatingCamera = false;
  private isPanningCamera = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastPanMouseX = 0;
  private lastPanMouseY = 0;
  private mouseDownTime = 0;
  private mouseMoved = false;
  private cameraBaseDistance = 0;

  // Data
  processedPackages: PackageData[] = [];
  deletedPackages: PackageData[] = [];
  private animationFrameId: number | null = null;
  private isDestroyed = false;
  private frameCount = 0;
  private lastUpdateTime = 0;

  // Timers
  private dataChangeTimeout: any = null;
  private pendingDataChange = false;
  private hoverThrottleTimeout: any = null;

  // ✅ Production için render management
  private needsRender = true;
  private isViewReady = false;

  // Color management
  private readonly COLOR_PALETTE = [
    '#006A6A', '#D6BB86', '#004A4A', '#C0A670', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
    '#14b8a6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa',
    '#f472b6', '#fb7185', '#fbbf24', '#a3e635', '#22d3ee'
  ];
  private usedColors = new Set<string>();

  constructor(
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.gltfLoader = new GLTFLoader();
    this.isLoadingModels = true;
  }

  async ngAfterViewInit(): Promise<void> {
    // ✅ View hazır olduktan sonra Three.js'i başlat
    await this.initializeThreeJS();
  }

  private async initializeThreeJS(): Promise<void> {
    try {
      // 1️⃣ Scene setup
      this.setupThreeJS();
      await this.delay(50);

      // 2️⃣ Render loop başlat
      this.startRenderLoop();
      await this.delay(50);

      // 3️⃣ Modelleri yükle
      await this.loadAllModels();

      // 4️⃣ View ready
      this.isViewReady = true;

      // 5️⃣ Data varsa process et
      if (this.piecesData && (Array.isArray(this.piecesData) ? this.piecesData.length > 0 : true)) {
        await this.safeProcessData();
      }

      // 6️⃣ Son render
      this.forceRender();

    } catch (error) {
      console.error('❌ Three.js initialization error:', error);
      this.isLoadingModels = false;
      this.cdr.detectChanges();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isDestroyed || !this.isViewReady) return;

    if (changes['piecesData'] || changes['truckDimension']) {
      if (this.scene && this.truckGroup && this.packagesGroup) {
        this.safeProcessData();
      }
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanup();
  }

  // ========================================
  // MODEL LOADING
  // ========================================

  private async loadAllModels(): Promise<void> {
    try {
      this.isLoadingModels = true;

      await Promise.all([
        this.loadTruckModel(),
        this.loadTrailerWheelModel()
      ]);

      // ✅ Modeller yüklendi, birkaç kere render et
      await this.delay(100);
      for (let i = 0; i < 5; i++) {
        this.forceRender();
        await this.delay(50);
      }

      this.isLoadingModels = false;

      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });

    } catch (error) {
      console.error('❌ Model loading error:', error);
      this.isLoadingModels = false;
      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    }
  }

  private loadTruckModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      const baseUrl = window.location.origin;
      const modelPath = `${baseUrl}/assets/models/truck/truck.gltf`;

      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          this.truckModel = gltf.scene;

          const box = new THREE.Box3().setFromObject(this.truckModel);
          const size = box.getSize(new THREE.Vector3());

          const scaleX = this.truckDimension()[0] / size.x;
          const scaleY = this.truckDimension()[2] / size.y;
          const scaleZ = this.truckDimension()[1] / size.z;

          const scale = Math.min(scaleX, scaleY, scaleZ);
          this.truckModel.scale.setScalar(scale * 2.5);

          this.truckModel.rotation.y = -Math.PI / 2;
          this.truckModel.position.set(0, 0, this.truckDimension()[1] / 2 + 100);

          this.truckModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.truckGroup.add(this.truckModel);
          this.modelsLoaded.truck = true;

          // ✅ Model eklendi, render et
          this.forceRender();

          setTimeout(() => resolve(), 100);
        },
        undefined,
        (error) => {
          console.error('❌ Truck model error:', error);
          reject(error);
        }
      );
    });
  }

  private loadTrailerWheelModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      const baseUrl = window.location.origin;
      const modelPath = `${baseUrl}/assets/models/truck/truck-wheels.gltf`;

      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          this.trailerWheelModel = gltf.scene;

          const box = new THREE.Box3().setFromObject(this.trailerWheelModel);
          const size = box.getSize(new THREE.Vector3());

          const scaleX = this.truckDimension()[0] / size.x;
          const scaleY = this.truckDimension()[2] / size.y;
          const scaleZ = this.truckDimension()[1] / size.z;

          const scale = Math.min(scaleX, scaleY, scaleZ);
          this.trailerWheelModel.scale.setScalar(scale);

          this.trailerWheelModel.rotation.y = Math.PI / 2;
          this.trailerWheelModel.position.set(
            this.truckDimension()[0] / 2,
            0,
            this.truckDimension()[1] / 2
          );

          this.trailerWheelModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.truckGroup.add(this.trailerWheelModel);
          this.modelsLoaded.trailerWheel = true;

          // ✅ Model eklendi, render et
          this.forceRender();

          setTimeout(() => resolve(), 100);
        },
        undefined,
        (error) => {
          console.error('❌ Wheel model error:', error);
          reject(error);
        }
      );
    });
  }

  // ========================================
  // KEYBOARD SHORTCUTS
  // ========================================

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (this.isDragging) return;

    switch (event.key) {
      case 'r':
      case 'R':
        if (this.selectedPackage) {
          event.preventDefault();
          this.rotateSelectedPackage();
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (this.selectedPackage) {
          event.preventDefault();
          this.deleteSelectedPackage();
        }
        break;

      case 'Escape':
        if (this.selectedPackage) {
          event.preventDefault();
          this.clearSelection();
        }
        break;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.renderer || !this.camera || !this.threeContainer) return;

    const container = this.threeContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.forceRender();
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  restoreAllPackages(): void {
    if (this.deletedPackages.length === 0) return;

    const totalDeleted = this.deletedPackages.length;
    const packagesToRestore = [...this.deletedPackages];
    let restoredCount = 0;
    let rotatedCount = 0;

    packagesToRestore.forEach(pkg => {
      const beforeLength = this.processedPackages.length;
      const hadRotation = pkg.rotation && pkg.rotation % 180 === 90;

      this.restorePackage(pkg);

      const afterLength = this.processedPackages.length;

      if (afterLength > beforeLength) {
        restoredCount++;
        const restoredPkg = this.processedPackages[afterLength - 1];
        if (restoredPkg.rotation && restoredPkg.rotation % 180 === 90 && !hadRotation) {
          rotatedCount++;
        }
      }
    });

    console.log(`✅ ${restoredCount}/${totalDeleted} paket geri yüklendi (${rotatedCount} döndürüldü)`);
  }

  clearDeletedPackages(): void {
    if (this.deletedPackages.length === 0) return;

    const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
      width: '400px',
      maxWidth: '95vw',
      disableClose: true,
      panelClass: 'cancel-confirmation-dialog',
      data: {
        header: "Silinen paketleri kalıcı olarak kaldır!",
        title: "Silinen paketler siparişten kaldırılacaklar!",
        info: "Eğer bu şekide devam etmek isterseniz yerleştirilmeyen ürünler siparişten kaldırılacaktır.",
        confirmButtonText: "Yine de devam et."
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.store.dispatch(cleanUpInvalidPackagesFromOrder({
          packageNames: this.deletedPackages.map((pckg) => pckg.id)
        }));
        this.deletedPackages.forEach(pkg => {
          if (pkg.originalColor) {
            this.releaseColor(pkg.originalColor);
          }
        });
        this.deletedPackages = [];
        this.cdr.detectChanges();
      }
    });
  }

  // ========================================
  // THREE.JS SETUP
  // ========================================

  private setupThreeJS(): void {
    const container = this.threeContainer.nativeElement;

    // Scene
    this.scene = new THREE.Scene();

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
    this.scene.background = gradientTexture;

    // Camera
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100000);

    this.cameraTarget.set(
      this.truckDimension()[0] / 2,
      this.truckDimension()[2] / 2,
      this.truckDimension()[1] / 2
    );

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupSmoothMouseEvents();

    // Groups
    this.truckGroup = new THREE.Group();
    this.packagesGroup = new THREE.Group();
    this.packagesGroup.position.y = 1100;

    this.scene.add(this.truckGroup);
    this.scene.add(this.packagesGroup);

    this.createPlatform();
    this.createGroundPlane();

    this.dragPlane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0)
    );

    this.setView('isometric');
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5000, 8000, 3000);
    mainLight.castShadow = true;

    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 20000;
    mainLight.shadow.camera.left = -8000;
    mainLight.shadow.camera.right = 8000;
    mainLight.shadow.camera.top = 8000;
    mainLight.shadow.camera.bottom = -8000;
    mainLight.shadow.bias = -0.0005;

    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3000, 4000, -2000);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xadd8e6, 0.2);
    rimLight.position.set(-2000, 3000, 5000);
    this.scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    this.scene.add(hemiLight);
  }

  private createGroundPlane(): void {
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

    this.scene.add(groundMesh);
  }

  private createPlatform(): void {
    const platformLength = this.truckDimension()[0];
    const platformWidth = this.truckDimension()[1];
    const platformHeight = 200;

    const geometry = new THREE.BoxGeometry(platformLength, platformHeight, platformWidth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      metalness: 0.3,
      roughness: 0.7,
      side: THREE.DoubleSide
    });

    this.platformMesh = new THREE.Mesh(geometry, material);
    this.platformMesh.position.set(
      this.truckDimension()[0] / 2,
      1100 - platformHeight / 2,
      this.truckDimension()[1] / 2
    );

    this.platformMesh.castShadow = false;
    this.platformMesh.receiveShadow = true;

    this.scene.add(this.platformMesh);
  }

  // ========================================
  // WEIGHT CALCULATION
  // ========================================

  get frontSectionWeight(): number {
    if (!this.processedPackages || this.processedPackages.length === 0) {
      return 0;
    }

    return this.processedPackages.reduce((total, pkg) => {
      const packageStart = pkg.x;
      const packageEnd = pkg.x + pkg.length;

      if (packageStart >= this.weightCalculationDepth) {
        return total;
      }

      if (packageEnd <= this.weightCalculationDepth) {
        return total + (pkg.weight || 0);
      }

      const overlapLength = this.weightCalculationDepth - packageStart;
      const overlapRatio = overlapLength / pkg.length;
      const partialWeight = (pkg.weight || 0) * overlapRatio;

      return total + partialWeight;
    }, 0);
  }

  get frontSectionWeightDisplay(): string {
    const weight = this.frontSectionWeight;
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)} ton`;
    }
    return `${weight.toFixed(0)} kg`;
  }

  // ========================================
  // MOUSE EVENTS
  // ========================================

  private setupSmoothMouseEvents(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: false });
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: false });
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this), { passive: false });
    canvas.addEventListener('click', this.handleMouseClick.bind(this), { passive: false });
    canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, { passive: false });
  }

  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();

    this.mouseDownTime = Date.now();
    this.mouseMoved = false;
    this.updateMouseCoordinates(event);

    if (event.button === 0) {
      const intersectedPackage = this.getIntersectedPackage();
      if (intersectedPackage && this.dragModeEnabled) {
        this.initiateDragging(intersectedPackage);
      }
    } else if (event.button === 1) {
      event.preventDefault();
      this.startCameraPanning(event);
    } else if (event.button === 2) {
      if (event.ctrlKey) {
        this.startCameraPanning(event);
      } else {
        this.startCameraRotation(event);
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    this.mouseMoved = true;
    this.updateMouseCoordinates(event);

    if (this.isDragging && this.draggedPackage) {
      this.updateDraggedPackageWithSnapping();
      this.needsRender = true;
    } else if (this.isRotatingCamera) {
      this.updateCameraRotationSmooth(event);
      this.needsRender = true;
    } else if (this.isPanningCamera) {
      this.updateCameraPanning(event);
      this.needsRender = true;
    } else if (!this.isDragging && !this.isRotatingCamera && !this.isPanningCamera) {
      this.updateHoverEffectsThrottled();
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    event.preventDefault();

    const clickDuration = Date.now() - this.mouseDownTime;

    if (this.isDragging) {
      this.completeDragging();
    }

    if (this.isRotatingCamera) {
      this.stopCameraRotation();
    }

    if (this.isPanningCamera) {
      this.stopCameraPanning();
    }

    if (event.button === 0 && !this.mouseMoved && clickDuration < 200 && !this.isDragging) {
      setTimeout(() => this.handleMouseClick(event), 10);
    }
  }

  private handleMouseClick(event: MouseEvent): void {
    if (this.isDragging || this.isRotatingCamera || this.mouseMoved) return;

    event.preventDefault();
    this.updateMouseCoordinates(event);

    const intersectedPackage = this.getIntersectedPackage();

    if (intersectedPackage) {
      this.selectPackage(intersectedPackage);
    } else {
      this.clearSelection();
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomSpeed = 1;
    const delta = event.deltaY > 0 ? 1 : -1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta * zoomSpeed));
    this.setZoomLevelPreserveTarget(newZoom);
    this.needsRender = true;
  }

  // ========================================
  // CAMERA CONTROLS
  // ========================================

  private startCameraRotation(event: MouseEvent): void {
    this.isRotatingCamera = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  private updateCameraRotationSmooth(event: MouseEvent): void {
    if (!this.isRotatingCamera) return;

    const deltaX = (event.clientX - this.lastMouseX) * 0.005;
    const deltaY = (event.clientY - this.lastMouseY) * 0.005;

    this.rotateViewAroundTarget(deltaX, deltaY);

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private stopCameraRotation(): void {
    this.isRotatingCamera = false;
    this.renderer.domElement.style.cursor = this.dragModeEnabled ? 'grab' : 'default';
  }

  private startCameraPanning(event: MouseEvent): void {
    this.isPanningCamera = true;
    this.lastPanMouseX = event.clientX;
    this.lastPanMouseY = event.clientY;
    this.renderer.domElement.style.cursor = 'move';
  }

  private updateCameraPanning(event: MouseEvent): void {
    if (!this.isPanningCamera) return;

    const deltaX = event.clientX - this.lastPanMouseX;
    const deltaY = event.clientY - this.lastPanMouseY;

    const distance = this.camera.position.distanceTo(this.cameraTarget);
    const panSensitivity = distance * 0.001;

    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();

    cameraRight.setFromMatrixColumn(this.camera.matrix, 0);
    cameraUp.setFromMatrixColumn(this.camera.matrix, 1);

    const panOffset = new THREE.Vector3();
    panOffset.add(cameraRight.multiplyScalar(-deltaX * panSensitivity));
    panOffset.add(cameraUp.multiplyScalar(deltaY * panSensitivity));

    const newCameraPosition = this.camera.position.clone().add(panOffset);
    const newTargetPosition = this.cameraTarget.clone().add(panOffset);

    if (newCameraPosition.y < this.minCameraHeight) {
      const heightDiff = this.minCameraHeight - newCameraPosition.y;
      panOffset.y += heightDiff;
      newCameraPosition.y = this.minCameraHeight;
      newTargetPosition.y = this.cameraTarget.y + heightDiff;
    }

    this.camera.position.copy(newCameraPosition);
    this.cameraTarget.copy(newTargetPosition);

    this.lastPanMouseX = event.clientX;
    this.lastPanMouseY = event.clientY;
  }

  private stopCameraPanning(): void {
    this.isPanningCamera = false;
    this.renderer.domElement.style.cursor = this.dragModeEnabled ? 'grab' : 'default';
  }

  private rotateViewAroundTarget(deltaX: number, deltaY: number): void {
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position.clone().sub(this.cameraTarget));

    spherical.theta -= deltaX;
    spherical.phi = Math.max(
      this.minCameraPhi,
      Math.min(this.maxCameraPhi, spherical.phi - deltaY)
    );

    const newPosition = new THREE.Vector3()
      .setFromSpherical(spherical)
      .add(this.cameraTarget);

    if (newPosition.y < this.minCameraHeight) {
      newPosition.y = this.minCameraHeight;
    }

    this.camera.position.copy(newPosition);
    this.camera.lookAt(this.cameraTarget);
  }

  private setZoomLevelPreserveTarget(value: number): void {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(value)));

    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, this.cameraTarget).normalize();

    if (this.cameraBaseDistance === 0) {
      this.cameraBaseDistance = this.camera.position.distanceTo(this.cameraTarget);
    }

    const scaleFactor = (100 / this.zoomLevel);
    const newDistance = this.cameraBaseDistance * scaleFactor;

    const newPosition = new THREE.Vector3().addVectors(
      this.cameraTarget,
      direction.multiplyScalar(newDistance)
    );

    if (newPosition.y < this.minCameraHeight) {
      newPosition.y = this.minCameraHeight;
    }

    this.camera.position.copy(newPosition);
    this.camera.lookAt(this.cameraTarget);
  }

  // ========================================
  // DRAG SYSTEM
  // ========================================

  private initiateDragging(packageData: PackageData): void {
    this.isDragging = true;
    this.draggedPackage = packageData;
    packageData.isBeingDragged = true;

    if (packageData.mesh) {
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const packageY = packageData.mesh.position.y;
      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, packageY, 0)
      );

      const intersectionPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint)) {
        this.dragOffset.subVectors(packageData.mesh.position, intersectionPoint);
        this.lastDragPosition.copy(packageData.mesh.position);
        this.highlightDraggedPackage();
        this.renderer.domElement.style.cursor = 'grabbing';
        this.temporarilyHideUIElements();
      } else {
        this.cancelDragging();
      }
    }
  }

  private updateDraggedPackageWithSnapping(): void {
    if (!this.isDragging || !this.draggedPackage?.mesh) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersectionPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint)) {
      const targetPosition = new THREE.Vector3().addVectors(intersectionPoint, this.dragOffset);
      const currentPosition = this.draggedPackage.mesh.position;

      const smoothPosition = new THREE.Vector3().lerpVectors(
        currentPosition,
        targetPosition,
        this.dragSensitivity
      );

      const pkg = this.draggedPackage;

      smoothPosition.x = Math.max(
        pkg.length / 2,
        Math.min(this.truckDimension()[0] - pkg.length / 2, smoothPosition.x)
      );
      smoothPosition.z = Math.max(
        pkg.width / 2,
        Math.min(this.truckDimension()[1] - pkg.width / 2, smoothPosition.z)
      );

      const snappedPosition = this.snapToNearbyPackages(pkg, smoothPosition);

      if (this.lastDragPosition.distanceTo(snappedPosition) > 0.5) {
        const testPosition = {
          x: snappedPosition.x - pkg.length / 2,
          y: snappedPosition.z - pkg.width / 2,
          z: pkg.z
        };

        if (!this.checkCollisionPrecise(pkg, testPosition)) {
          pkg.mesh?.position.copy(snappedPosition);
          pkg.x = testPosition.x;
          pkg.y = testPosition.y;
          this.lastDragPosition.copy(snappedPosition);
          this.pendingDataChange = true;
          this.clearCollisionWarning();
        } else {
          const hasSnapped = snappedPosition.distanceTo(smoothPosition) > 1;

          if (hasSnapped) {
            const smoothTestPos = {
              x: smoothPosition.x - pkg.length / 2,
              y: smoothPosition.z - pkg.width / 2,
              z: pkg.z
            };

            if (!this.checkCollisionPrecise(pkg, smoothTestPos)) {
              pkg.mesh?.position.copy(smoothPosition);
              pkg.x = smoothTestPos.x;
              pkg.y = smoothTestPos.y;
              this.lastDragPosition.copy(smoothPosition);
              this.pendingDataChange = true;
              this.clearCollisionWarning();
            } else {
              this.showCollisionWarningBriefly();
            }
          } else {
            this.showCollisionWarningBriefly();
          }
        }
      }
    }
  }

  private checkCollisionPrecise(
    packageToCheck: PackageData,
    newPos: { x: number, y: number, z: number }
  ): boolean {
    const checkLength = packageToCheck.length;
    const checkWidth = packageToCheck.width;

    for (const otherPackage of this.processedPackages) {
      if (otherPackage.id === packageToCheck.id || !otherPackage.mesh) continue;

      const otherLength = otherPackage.length;
      const otherWidth = otherPackage.width;

      if (newPos.x < otherPackage.x + otherLength &&
        newPos.x + checkLength > otherPackage.x &&
        newPos.y < otherPackage.y + otherWidth &&
        newPos.y + checkWidth > otherPackage.y &&
        newPos.z < otherPackage.z + otherPackage.height &&
        newPos.z + packageToCheck.height > otherPackage.z) {
        return true;
      }
    }
    return false;
  }

  private completeDragging(): void {
    if (!this.isDragging || !this.draggedPackage) return;

    if (this.draggedPackage.mesh) {
      const material = this.draggedPackage.mesh.material as THREE.MeshLambertMaterial;
      material.wireframe = this.wireframeMode;
      material.emissive.setHex(0x000000);
    }

    this.draggedPackage.isBeingDragged = false;

    if (this.pendingDataChange) {
      this.orderResultChange();
      this.pendingDataChange = false;
    }

    this.isDragging = false;
    this.draggedPackage = null;
    this.renderer.domElement.style.cursor = this.dragModeEnabled ? 'grab' : 'default';
    this.clearHighlights();
    this.restoreUIElements();

    if (this.selectedPackage) {
      this.highlightSelectedPackage();
    }

    this.forceRender();
  }

  // ========================================
  // COLOR MANAGEMENT
  // ========================================

  private getUniqueColor(): string {
    for (const color of this.COLOR_PALETTE) {
      if (!this.usedColors.has(color)) {
        this.usedColors.add(color);
        return color;
      }
    }
    const randomColor = `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')}`;
    this.usedColors.add(randomColor);
    return randomColor;
  }

  private releaseColor(color: string): void {
    this.usedColors.delete(color);
  }

  // ========================================
  // ROTATION SYSTEM
  // ========================================

  rotateSelectedPackage(): void {
    if (!this.selectedPackage?.mesh) return;

    if (!this.selectedPackage.originalLength) {
      this.selectedPackage.originalLength = this.selectedPackage.length;
      this.selectedPackage.originalWidth = this.selectedPackage.width;
    }

    const oldLength = this.selectedPackage.length;
    const oldWidth = this.selectedPackage.width;

    this.selectedPackage.length = oldWidth;
    this.selectedPackage.width = oldLength;

    if (this.checkCollisionPrecise(this.selectedPackage, {
      x: this.selectedPackage.x,
      y: this.selectedPackage.y,
      z: this.selectedPackage.z
    })) {
      this.selectedPackage.length = oldLength;
      this.selectedPackage.width = oldWidth;
      this.showCollisionWarningBriefly();
      return;
    }

    this.selectedPackage.rotation = (this.selectedPackage.rotation || 0) + 90;
    this.selectedPackage.dimensions = `${this.selectedPackage.length}×${this.selectedPackage.width}×${this.selectedPackage.height}mm`;

    this.recreatePackageMeshCompletely(this.selectedPackage);
    this.highlightSelectedPackage();
    this.orderResultChange();

    this.forceRender();
    this.cdr.detectChanges();
  }

  private recreatePackageMeshCompletely(packageData: PackageData): void {
    if (packageData.mesh) {
      const material = packageData.mesh.material as THREE.MeshLambertMaterial;
      material.emissive.setHex(0x000000);

      this.packagesGroup.remove(packageData.mesh);
      packageData.mesh.geometry.dispose();
      material.dispose();
      packageData.mesh = undefined;
    }

    const geometry = new THREE.BoxGeometry(
      packageData.length,
      packageData.height,
      packageData.width
    );

    const material = new THREE.MeshLambertMaterial({
      color: packageData.color,
      transparent: false,
      opacity: 1.0,
      wireframe: this.wireframeMode
    });

    const newMesh = new THREE.Mesh(geometry, material);

    newMesh.position.set(
      packageData.x + packageData.length / 2,
      packageData.z + packageData.height / 2,
      packageData.y + packageData.width / 2
    );

    newMesh.castShadow = true;
    newMesh.receiveShadow = true;
    newMesh.userData = { packageData };

    packageData.mesh = newMesh;
    this.packagesGroup.add(newMesh);
  }

  // ========================================
  // PACKAGE MANAGEMENT
  // ========================================

  deleteSelectedPackage(): void {
    if (!this.selectedPackage) return;

    const index = this.processedPackages.findIndex(pkg => pkg.id === this.selectedPackage!.id);
    if (index > -1) {
      const deletedPackage = this.processedPackages.splice(index, 1)[0];

      if (deletedPackage.originalColor) {
        this.releaseColor(deletedPackage.originalColor);
      }

      if (deletedPackage.mesh) {
        this.packagesGroup.remove(deletedPackage.mesh);
        deletedPackage.mesh.geometry.dispose();
        (deletedPackage.mesh.material as THREE.Material).dispose();
      }

      this.deletedPackages.push(deletedPackage);
      this.selectedPackage = null;
      this.orderResultChange();
      this.forceRender();
    }
  }

  restorePackage(packageData: PackageData): void {
    const index = this.deletedPackages.findIndex(pkg => pkg.id === packageData.id);
    if (index > -1) {
      this.deletedPackages.splice(index, 1);
    }

    let validPosition = this.findValidPosition(packageData);

    if (!validPosition) {
      const originalLength = packageData.length;
      const originalWidth = packageData.width;

      packageData.length = originalWidth;
      packageData.width = originalLength;

      validPosition = this.findValidPosition(packageData);

      if (validPosition) {
        packageData.rotation = (packageData.rotation || 0) + 90;
        packageData.dimensions = `${packageData.length}×${packageData.width}×${packageData.height}mm`;

        if (!packageData.originalLength) {
          packageData.originalLength = originalWidth;
          packageData.originalWidth = originalLength;
        }
      } else {
        packageData.length = originalLength;
        packageData.width = originalWidth;
      }
    }

    if (validPosition) {
      packageData.x = validPosition.x;
      packageData.y = validPosition.y;
      packageData.z = validPosition.z;

      if (packageData.originalColor) {
        packageData.color = packageData.originalColor;
        this.usedColors.add(packageData.originalColor);
      } else {
        packageData.color = this.getUniqueColor();
        packageData.originalColor = packageData.color;
      }

      this.createPackageMesh(packageData);
      this.processedPackages.push(packageData);
      this.orderResultChange();
      this.forceRender();
    } else {
      this.deletedPackages.push(packageData);
    }
  }

  // ========================================
  // DATA PROCESSING
  // ========================================

  private processData(): void {
    const pieces = typeof this.piecesData === 'string'
      ? JSON.parse(this.piecesData)
      : this.piecesData;

    if (!pieces || pieces.length === 0) {
      this.processedPackages = [];
      this.deletedPackages = [];
      this.originalPackageCount = 0;
      this.usedColors.clear();
      return;
    }

    const stateMap = new Map();
    this.processedPackages.forEach(pkg => {
      stateMap.set(pkg.id, {
        color: pkg.color,
        originalColor: pkg.originalColor,
        rotation: pkg.rotation || 0,
        originalLength: pkg.originalLength,
        originalWidth: pkg.originalWidth
      });
    });

    const processed: PackageData[] = [];
    const deleted: PackageData[] = [];

    pieces.forEach((piece: any, index: number) => {
      const id = piece[6] || index;
      const saved = stateMap.get(id);

      let length = piece[3] || 0;
      let width = piece[4] || 0;
      let rotation = 0;
      let originalLength = length;
      let originalWidth = width;

      if (saved) {
        rotation = saved.rotation;
        originalLength = saved.originalLength || length;
        originalWidth = saved.originalWidth || width;

        if (rotation % 180 === 90) {
          length = originalWidth;
          width = originalLength;
        }
      }

      let color: string;
      let originalColor: string;

      if (saved) {
        color = saved.color || this.getUniqueColor();
        originalColor = saved.originalColor || color;
      } else {
        color = this.getUniqueColor();
        originalColor = color;
      }

      const pkg: PackageData = {
        id,
        x: piece[0] || 0,
        y: piece[1] || 0,
        z: piece[2] || 0,
        length,
        width,
        height: piece[5] || 0,
        weight: piece[7] || 0,
        color,
        originalColor,
        rotation,
        originalLength,
        originalWidth,
        dimensions: `${length}×${width}×${piece[5] || 0}mm`,
        isBeingDragged: false
      };

      if (piece[0] === -1 && piece[1] === -1 && piece[2] === -1) {
        deleted.push(pkg);
      } else {
        processed.push(pkg);
      }
    });

    this.processedPackages = processed;
    if (deleted.length != 0) {
      this.deletedPackages = deleted;
    }
    this.originalPackageCount = this.processedPackages.length;
  }

  private createPackageMesh(packageData: PackageData): void {
    this.recreatePackageMeshCompletely(packageData);
  }

  // ========================================
  // CAMERA VIEW SYSTEM
  // ========================================

  setView(viewType: string): void {
    this.currentView = viewType;

    this.cameraTarget.set(
      this.truckDimension()[0] / 2,
      this.truckDimension()[2] / 2,
      this.truckDimension()[1] / 2
    );

    const maxDim = Math.max(...this.truckDimension());
    const distance = maxDim * 1.5;
    this.cameraBaseDistance = distance;

    switch (viewType) {
      case 'front':
        this.camera.position.set(distance, this.cameraTarget.y, this.cameraTarget.z);
        break;
      case 'side':
        this.camera.position.set(this.cameraTarget.x, this.cameraTarget.y, distance);
        break;
      case 'top':
        this.camera.position.set(this.cameraTarget.x, distance, this.cameraTarget.z);
        break;
      case 'isometric':
      default:
        this.camera.position.set(
          this.cameraTarget.x + distance * 0.4,
          this.cameraTarget.y + distance * 0.4,
          this.cameraTarget.z + distance * 0.4
        );
        break;
    }

    this.camera.lookAt(this.cameraTarget);
    this.forceRender();
  }

  resetView(): void {
    this.zoomLevel = 100;
    this.setView('isometric');
  }

  // ========================================
  // UI HELPERS AND UTILITIES
  // ========================================

  private updateMouseCoordinates(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getIntersectedPackage(): PackageData | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.packagesGroup.children);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      return mesh.userData['packageData'] || null;
    }
    return null;
  }

  private selectPackage(packageData: PackageData): void {
    this.clearHighlights();
    this.selectedPackage = packageData;
    this.highlightSelectedPackage();
    this.forceRender();
  }

  clearSelection(): void {
    this.selectedPackage = null;
    this.clearHighlights();
    this.forceRender();
  }

  private highlightSelectedPackage(): void {
    this.clearHighlights();

    if (this.selectedPackage?.mesh) {
      const material = this.selectedPackage.mesh.material as THREE.MeshLambertMaterial;
      material.emissive.setHex(0x666666);
    }
  }

  private highlightDraggedPackage(): void {
    if (this.draggedPackage?.mesh) {
      const material = this.draggedPackage.mesh.material as THREE.MeshLambertMaterial;
      const isInSnapZone = this.isNearOtherPackages(this.draggedPackage, 50);

      if (isInSnapZone) {
        material.emissive.setHex(0x0088ff);
      } else {
        material.emissive.setHex(0x888888);
      }

      material.wireframe = true;
    }
  }

  private isNearOtherPackages(pkg: PackageData, threshold: number): boolean {
    for (const otherPkg of this.processedPackages) {
      if (otherPkg.id === pkg.id || !otherPkg.mesh) continue;

      const distX = Math.min(
        Math.abs(pkg.x - (otherPkg.x + otherPkg.length)),
        Math.abs((pkg.x + pkg.length) - otherPkg.x)
      );

      const distY = Math.min(
        Math.abs(pkg.y - (otherPkg.y + otherPkg.width)),
        Math.abs((pkg.y + pkg.width) - otherPkg.y)
      );

      if (distX < threshold || distY < threshold) {
        return true;
      }
    }
    return false;
  }

  private clearHighlights(): void {
    this.processedPackages.forEach(pkg => {
      if (pkg.mesh && !pkg.isBeingDragged) {
        const material = pkg.mesh.material as THREE.MeshLambertMaterial;
        material.emissive.setHex(0x000000);
        material.wireframe = this.wireframeMode;
        pkg.mesh.scale.setScalar(1.0);
      }
    });
  }

  private updateHoverEffectsThrottled(): void {
    if (this.hoverThrottleTimeout) return;
    this.hoverThrottleTimeout = setTimeout(() => {
      this.updateHoverEffects();
      this.hoverThrottleTimeout = null;
    }, 50);
  }

  private updateHoverEffects(): void {
    if (this.isDragging) return;

    const hoveredPackage = this.getIntersectedPackage();
    this.processedPackages.forEach(pkg => {
      if (pkg.mesh && pkg !== this.selectedPackage && !pkg.isBeingDragged) {
        const material = pkg.mesh.material as THREE.MeshLambertMaterial;
        if (pkg === hoveredPackage) {
          material.emissive.setHex(0x333333);
        } else {
          material.emissive.setHex(0x000000);
        }
        pkg.mesh.scale.setScalar(1.0);
      }
    });
    this.needsRender = true;
  }

  private snapToNearbyPackages(pkg: PackageData, targetPos: THREE.Vector3): THREE.Vector3 {
    const snapThreshold = 50;
    const snappedPos = targetPos.clone();

    const pkgPos = {
      x: targetPos.x - pkg.length / 2,
      y: targetPos.z - pkg.width / 2,
      z: pkg.z
    };

    let snappedX = pkgPos.x;
    let snappedY = pkgPos.y;

    for (const otherPkg of this.processedPackages) {
      if (otherPkg.id === pkg.id || !otherPkg.mesh) continue;

      const distToLeft = Math.abs(pkgPos.x - (otherPkg.x + otherPkg.length));
      if (distToLeft < snapThreshold && distToLeft < Math.abs(pkgPos.x - otherPkg.x)) {
        snappedX = otherPkg.x + otherPkg.length;
      }

      const distToRight = Math.abs((pkgPos.x + pkg.length) - otherPkg.x);
      if (distToRight < snapThreshold && distToRight < distToLeft) {
        snappedX = otherPkg.x - pkg.length;
      }

      const distToFront = Math.abs(pkgPos.y - (otherPkg.y + otherPkg.width));
      if (distToFront < snapThreshold && distToFront < Math.abs(pkgPos.y - otherPkg.y)) {
        snappedY = otherPkg.y + otherPkg.width;
      }

      const distToBack = Math.abs((pkgPos.y + pkg.width) - otherPkg.y);
      if (distToBack < snapThreshold && distToBack < distToFront) {
        snappedY = otherPkg.y - pkg.width;
      }
    }

    snappedPos.x = snappedX + pkg.length / 2;
    snappedPos.z = snappedY + pkg.width / 2;

    return snappedPos;
  }

  private cancelDragging(): void {
    if (this.draggedPackage) {
      this.draggedPackage.isBeingDragged = false;
    }
    this.isDragging = false;
    this.draggedPackage = null;
    this.renderer.domElement.style.cursor = this.dragModeEnabled ? 'grab' : 'default';
    this.restoreUIElements();
  }

  private temporarilyHideUIElements(): void {
    this.showControls = false;
    this.showStats = false;
  }

  private restoreUIElements(): void {
    this.showControls = true;
    this.showStats = true;
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.cdr.detectChanges();
      }
    }, 50);
  }

  private showCollisionWarningBriefly(): void {
    if (!this.showCollisionWarning) {
      this.showCollisionWarning = true;
      if (this.draggedPackage?.mesh) {
        const material = this.draggedPackage.mesh.material as THREE.MeshLambertMaterial;
        material.emissive.setHex(0xff0000);
      }
      setTimeout(() => {
        this.clearCollisionWarning();
      }, 500);
    }
  }

  private clearCollisionWarning(): void {
    this.showCollisionWarning = false;
    if (this.draggedPackage?.mesh) {
      const material = this.draggedPackage.mesh.material as THREE.MeshLambertMaterial;
      material.emissive.setHex(0x666666);
    }
  }

  private orderResultChange(): void {
    this.store.dispatch(setStep3IsDirty());
  }

  private findValidPosition(packageData: PackageData): { x: number, y: number, z: number } | null {
    if (!this.checkCollisionPrecise(packageData, {
      x: packageData.x,
      y: packageData.y,
      z: packageData.z
    })) {
      return { x: packageData.x, y: packageData.y, z: packageData.z };
    }

    const stepSize = 100;

    for (let x = 0; x <= this.truckDimension()[0] - packageData.length; x += stepSize) {
      for (let y = 0; y <= this.truckDimension()[1] - packageData.width; y += stepSize) {
        const testPosition = { x, y, z: 0 };
        if (!this.checkCollisionPrecise(packageData, testPosition)) {
          return testPosition;
        }
      }
    }

    return null;
  }

  trackDeletedPackage(index: number, item: PackageData): any {
    return item.id;
  }

  // ========================================
  // LIFECYCLE METHODS
  // ========================================

  private async safeProcessData(): Promise<void> {
    if (this.isDestroyed) return;

    if (!this.scene || !this.truckGroup || !this.packagesGroup) {
      await this.delay(100);
      if (!this.isDestroyed) {
        return this.safeProcessData();
      }
      return;
    }

    this.isLoadingData = true;

    try {
      this.processData();
      this.createTruckVisualization();
      this.createPackageVisualization();

      this.forceRender();

    } catch (error) {
    } finally {
      this.isLoadingData = false;
      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    }
  }

  private createTruckVisualization(): void {
    if (!this.truckGroup) return;

    const savedTruckModel = this.truckModel;
    const savedTrailerWheelModel = this.trailerWheelModel;

    if (savedTruckModel) {
      this.truckGroup.remove(savedTruckModel);
    }
    if (savedTrailerWheelModel) {
      this.truckGroup.remove(savedTrailerWheelModel);
    }

    this.truckGroup.clear();

    const geometry = new THREE.BoxGeometry(
      this.truckDimension()[0],
      this.truckDimension()[2],
      this.truckDimension()[1]
    );

    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({
      color: 0x666666,
      linewidth: 2
    });

    const wireframe = new THREE.LineSegments(edges, material);
    wireframe.position.set(
      this.truckDimension()[0] / 2,
      this.truckDimension()[2] / 2 + 1100,
      this.truckDimension()[1] / 2
    );

    this.truckGroup.add(wireframe);

    if (savedTruckModel) {
      this.truckGroup.add(savedTruckModel);
    }
    if (savedTrailerWheelModel) {
      this.truckGroup.add(savedTrailerWheelModel);
    }
  }

  private createPackageVisualization(): void {
    if (!this.packagesGroup) return;

    this.packagesGroup.clear();
    this.processedPackages.forEach((packageData) => {
      this.createPackageMesh(packageData);
    });

    this.ngZone.run(() => {
      this.cdr.markForCheck();
    });
  }

  // ✅ Production için optimize render loop
  private startRenderLoop(): void {
    if (this.isDestroyed) return;

    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (this.isDestroyed) return;
        this.animationFrameId = requestAnimationFrame(animate);

        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }

        this.updatePerformanceStats(performance.now());
      };
      animate();
    });
  }

  private forceRender(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updatePerformanceStats(currentTime: number): void {
    this.frameCount++;
    if (this.frameCount % 60 === 0) {
      this.currentFPS = Math.round(1000 / (currentTime / this.frameCount));
      this.frameCount = 0;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    this.isDragging = false;
    this.isRotatingCamera = false;
    this.isPanningCamera = false;

    if (this.dataChangeTimeout) {
      clearTimeout(this.dataChangeTimeout);
      this.dataChangeTimeout = null;
    }

    if (this.hoverThrottleTimeout) {
      clearTimeout(this.hoverThrottleTimeout);
      this.hoverThrottleTimeout = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }

    this.processedPackages.forEach(pkg => {
      if (pkg.mesh) {
        pkg.mesh.geometry.dispose();
        (pkg.mesh.material as THREE.Material).dispose();
      }
    });

    this.usedColors.clear();
  }
}
