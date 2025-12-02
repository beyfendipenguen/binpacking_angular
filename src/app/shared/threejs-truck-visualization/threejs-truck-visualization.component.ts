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
  AfterViewInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { Store } from '@ngrx/store';
import { AppState, selectStep3IsDirty, selectTruck } from '../../store';
import { StepperUiActions } from '@app/store/stepper/actions/stepper-ui.actions';
import { ThreeJSRenderManagerService } from './services/threejs-render-manager.service';
import { ThreeJSComponents, ThreeJSInitializationService } from './services/threejs-initialization.service';

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
  pkgId: string;
}

@Component({
  selector: 'app-threejs-truck-visualization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './threejs-truck-visualization.component.html',
  styleUrl: './threejs-truck-visualization.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThreeJSTruckVisualizationComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('threeContainer', { static: true }) threeContainer!: ElementRef;

  @Input() piecesData: any[] | string = [];
  @Input() showHelp: boolean = true;
  @Input() showWeightDisplay: boolean = true;
  @Input() weightCalculationDepth: number = 3000;

  // Services
  private readonly store = inject(Store<AppState>);
  private readonly renderManager = inject(ThreeJSRenderManagerService);
  private readonly initService = inject(ThreeJSInitializationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  // Signals
  truckDimension = this.store.selectSignal(selectTruck);
  isDirty = this.store.selectSignal(selectStep3IsDirty)
  isLoadingSignal = signal(true);
  isDataLoadingSignal = signal(false);
  deletedPackagesSignal = signal<PackageData[]>([]);
  processedPackagesSignal = signal<PackageData[]>([]);
  selectedPackageSignal = signal<PackageData | null>(null);

  // Three.js components
  private threeComponents?: ThreeJSComponents;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private packagesGroup!: THREE.Group;

  // State
  modelsLoaded = { truck: false, trailerWheel: false };
  isLoadingModels = true;
  isLoadingData = false;
  hasThreeJSError = false;
  isDestroyed = false;
  isViewReady = false;

  // Camera controls
  private readonly minCameraPhi = Math.PI / 6;
  private readonly maxCameraPhi = Math.PI / 2.2;
  private readonly minCameraHeight = 500;
  private cameraTarget = new THREE.Vector3();
  private cameraBaseDistance = 0;
  minZoom = 100;
  maxZoom = 300;
  zoomLevel = 10;

  // Drag system
  private isDragging = false;
  private draggedPackage: PackageData | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private dragPlane = new THREE.Plane();
  private dragOffset = new THREE.Vector3();
  private dragSensitivity = 0.9;
  private lastDragPosition = new THREE.Vector3();

  // Camera interaction
  private isRotatingCamera = false;
  private isPanningCamera = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastPanMouseX = 0;
  private lastPanMouseY = 0;
  private mouseDownTime = 0;
  private mouseMoved = false;

  // UI State
  dragModeEnabled = true;
  wireframeMode = false;
  currentView = 'isometric';
  showControls = true;
  showStats = true;
  showCollisionWarning = false;

  // Data

  currentFPS = 60;

  // Color management
  private readonly COLOR_PALETTE = [
    '#006A6A', '#D6BB86', '#004A4A', '#C0A670', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
    '#14b8a6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa',
    '#f472b6', '#fb7185', '#fbbf24', '#a3e635', '#22d3ee'
  ];
  private usedColors = new Set<string>();

  // Throttles
  private hoverThrottleTimeout: any = null;

  constructor() { }

  ngOnInit(): void {
    console.log('[Component] ngOnInit - Başlatılıyor');
    this.isLoadingModels = true;
    this.isLoadingSignal.set(true);
  }

  async ngAfterViewInit(): Promise<void> {
    console.log('[Component] ngAfterViewInit - Three.js başlatılıyor');

    try {
      await this.initializeThreeJS();
      console.log('[Component] Three.js başarıyla başlatıldı');
    } catch (error) {
      console.error('[Component] Three.js başlatma hatası:', error);
      this.hasThreeJSError = true;
      this.isLoadingSignal.set(false);
      this.cdr.detectChanges();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isDestroyed || !this.isViewReady) return;

    if (changes['piecesData'] || changes['truckDimension']) {
      if (this.scene && this.packagesGroup) {
        this.safeProcessData();
      }
    }
  }

  ngOnDestroy(): void {
    console.log('[Component] ngOnDestroy - Cleanup başlatılıyor');
    this.isDestroyed = true;
    this.cleanup();
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  private async initializeThreeJS(): Promise<void> {
    try {
      this.isLoadingModels = true;
      this.isLoadingSignal.set(true);

      const container = this.threeContainer.nativeElement;
      const truckDims = this.truckDimension();

      console.log('[Component] Initialization başlatılıyor...', { truckDims });

      // Initialize via service
      this.threeComponents = await this.initService.initialize({
        containerElement: container,
        truckDimensions: truckDims,
        enableShadows: true,
        pixelRatio: 2
      });

      // Extract components
      this.scene = this.threeComponents.scene;
      this.camera = this.threeComponents.camera;
      this.renderer = this.threeComponents.renderer;
      this.packagesGroup = this.threeComponents.packagesGroup;

      // Setup camera target
      this.cameraTarget.set(
        truckDims[0] / 2,
        truckDims[2] / 2,
        truckDims[1] / 2
      );

      // Setup drag plane
      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0)
      );

      // Setup mouse events
      this.setupMouseEvents();

      // Start render loop
      this.renderManager.startRenderLoop(
        this.renderer,
        this.scene,
        this.camera
      );

      // Models loaded
      this.modelsLoaded.truck = true;
      this.modelsLoaded.trailerWheel = true;

      // Loading complete
      this.isLoadingModels = false;
      this.isLoadingSignal.set(false);
      this.isViewReady = true;

      console.log('[Component] Initialization tamamlandı');

      // Force initial render
      this.renderManager.requestRender();

      // Process data if available
      if (this.piecesData && (Array.isArray(this.piecesData) ? this.piecesData.length > 0 : true)) {
        await this.safeProcessData();
      }

      this.cdr.detectChanges();

    } catch (error) {
      console.error('[Component] Initialization hatası:', error);
      this.hasThreeJSError = true;
      this.isLoadingSignal.set(false);
      throw error;
    }
  }

  // ========================================
  // DATA PROCESSING
  // ========================================

  private async safeProcessData(): Promise<void> {
    if (this.isDestroyed || !this.isViewReady) return;

    this.isLoadingData = true;
    this.isDataLoadingSignal.set(true);

    try {
      this.processData();
      this.createPackageVisualization();

      this.renderManager.requestRender();
    } catch (error) {
      console.error('[Component] Data processing hatası:', error);
    } finally {
      this.isLoadingData = false;
      this.isDataLoadingSignal.set(false);

      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    }
  }

  private processData(): void {
    const pieces = typeof this.piecesData === 'string'
      ? JSON.parse(this.piecesData)
      : this.piecesData;

    if (!pieces || pieces.length === 0) {
      this.processedPackagesSignal.set([]);
      this.deletedPackagesSignal.set([]);
      this.usedColors.clear();
      return;
    }

    // Mevcut state'i koruyarak process et
    const stateMap = new Map();
    this.processedPackagesSignal().forEach(pkg => {
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
        isBeingDragged: false,
        pkgId: piece[8]
      };

      if (piece[0] === -1 && piece[1] === -1 && piece[2] === -1) {
        deleted.push(pkg);
      } else {
        processed.push(pkg);
      }
    });

    this.processedPackagesSignal.set(processed);
    if (deleted.length !== 0) {
      this.deletedPackagesSignal.set(deleted);
    }
  }

  private createPackageVisualization(): void {
    if (!this.packagesGroup) return;

    this.packagesGroup.clear();

    this.processedPackagesSignal().forEach((packageData) => {
      this.createPackageMesh(packageData);
    });

    this.ngZone.run(() => {
      this.cdr.markForCheck();
    });
  }

  private createPackageMesh(packageData: PackageData): void {
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

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      packageData.x + packageData.length / 2,
      packageData.z + packageData.height / 2,
      packageData.y + packageData.width / 2
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { packageData };

    packageData.mesh = mesh;
    this.packagesGroup.add(mesh);
  }

  // ========================================
  // MOUSE EVENTS
  // ========================================

  private setupMouseEvents(): void {
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
      // Left click - package drag
      const intersectedPackage = this.getIntersectedPackage();
      if (intersectedPackage && this.dragModeEnabled) {
        this.initiateDragging(intersectedPackage);
      }
    } else if (event.button === 1) {
      // Middle click - pan
      event.preventDefault();
      this.startCameraPanning(event);
    } else if (event.button === 2) {
      // Right click - rotate or pan
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
      this.renderManager.requestRender();
    } else if (this.isRotatingCamera) {
      this.updateCameraRotationSmooth(event);
      this.renderManager.requestRender();
    } else if (this.isPanningCamera) {
      this.updateCameraPanning(event);
      this.renderManager.requestRender();
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
    this.renderManager.requestRender();
  }

  private updateMouseCoordinates(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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
      const truckDims = this.truckDimension();

      smoothPosition.x = Math.max(
        pkg.length / 2,
        Math.min(truckDims[0] - pkg.length / 2, smoothPosition.x)
      );
      smoothPosition.z = Math.max(
        pkg.width / 2,
        Math.min(truckDims[1] - pkg.width / 2, smoothPosition.z)
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
          this.clearCollisionWarning();
          this.orderResultChange();
        } else {
          this.showCollisionWarningBriefly();
        }
      }
    }
  }

  private completeDragging(): void {
    if (!this.isDragging || !this.draggedPackage) return;

    if (this.draggedPackage.mesh) {
      const material = this.draggedPackage.mesh.material as THREE.MeshLambertMaterial;
      material.wireframe = this.wireframeMode;
      material.emissive.setHex(0x000000);
    }

    this.draggedPackage.isBeingDragged = false;
    this.isDragging = false;
    this.draggedPackage = null;
    this.renderer.domElement.style.cursor = this.dragModeEnabled ? 'grab' : 'default';
    this.clearHighlights();

    if (this.selectedPackageSignal()) {
      this.highlightSelectedPackage();
    }

    this.renderManager.requestRender();
  }

  private cancelDragging(): void {
    if (this.draggedPackage) {
      this.draggedPackage.isBeingDragged = false;
    }
    this.isDragging = false;
    this.draggedPackage = null;
    this.renderer.domElement.style.cursor = this.dragModeEnabled ? 'grab' : 'default';
  }

  // ========================================
  // COLLISION & SNAPPING
  // ========================================

  private checkCollisionPrecise(
    packageToCheck: PackageData,
    newPos: { x: number, y: number, z: number }
  ): boolean {
    const checkLength = packageToCheck.length;
    const checkWidth = packageToCheck.width;

    for (const otherPackage of this.processedPackagesSignal()) {
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

    for (const otherPkg of this.processedPackagesSignal()) {
      if (otherPkg.id === pkg.id || !otherPkg.mesh) continue;

      // X-axis snapping
      const distToLeft = Math.abs(pkgPos.x - (otherPkg.x + otherPkg.length));
      if (distToLeft < snapThreshold && distToLeft < Math.abs(pkgPos.x - otherPkg.x)) {
        snappedX = otherPkg.x + otherPkg.length;
      }

      const distToRight = Math.abs((pkgPos.x + pkg.length) - otherPkg.x);
      if (distToRight < snapThreshold && distToRight < distToLeft) {
        snappedX = otherPkg.x - pkg.length;
      }

      // Y-axis snapping
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

  // ========================================
  // PACKAGE SELECTION & HIGHLIGHTS
  // ========================================

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
    this.selectedPackageSignal.set(packageData);
    this.highlightSelectedPackage();
    this.renderManager.requestRender();
  }

  clearSelection(): void {
    this.selectedPackageSignal.set(null);
    this.clearHighlights();
    this.renderManager.requestRender();
  }

  private highlightSelectedPackage(): void {
    this.clearHighlights();
    const selected = this.selectedPackageSignal();
    if (selected?.mesh) {
      const material = selected.mesh.material as THREE.MeshLambertMaterial;
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

  private clearHighlights(): void {
    this.processedPackagesSignal().forEach(pkg => {
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
    this.processedPackagesSignal().forEach(pkg => {
      if (pkg.mesh && pkg !== this.selectedPackageSignal() && !pkg.isBeingDragged) {
        const material = pkg.mesh.material as THREE.MeshLambertMaterial;
        if (pkg === hoveredPackage) {
          material.emissive.setHex(0x333333);
        } else {
          material.emissive.setHex(0x000000);
        }
        pkg.mesh.scale.setScalar(1.0);
      }
    });
    this.renderManager.requestRender();
  }

  private isNearOtherPackages(pkg: PackageData, threshold: number): boolean {
    for (const otherPkg of this.processedPackagesSignal()) {
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

  // ========================================
  // PACKAGE OPERATIONS
  // ========================================

  rotateSelectedPackage(): void {
    const selected = this.selectedPackageSignal();
    if (!selected?.mesh) return;

    if (!selected.originalLength) {
      selected.originalLength = selected.length;
      selected.originalWidth = selected.width;
    }

    const oldLength = selected.length;
    const oldWidth = selected.width;

    selected.length = oldWidth;
    selected.width = oldLength;

    if (this.checkCollisionPrecise(selected, {
      x: selected.x,
      y: selected.y,
      z: selected.z
    })) {
      selected.length = oldLength;
      selected.width = oldWidth;
      this.showCollisionWarningBriefly();
      return;
    }

    selected.rotation = (selected.rotation || 0) + 90;
    selected.dimensions = `${selected.length}×${selected.width}×${selected.height}mm`;

    this.recreatePackageMesh(selected);
    this.highlightSelectedPackage();
    this.orderResultChange();

    this.renderManager.requestRender();
    this.cdr.detectChanges();
  }

  deleteSelectedPackage(): void {
    const selected = this.selectedPackageSignal();
    if (!selected) return;

    const packages = this.processedPackagesSignal();
    const index = packages.findIndex(pkg => pkg.id === selected.id);
    if (index > -1) {
      const deletedPackage = packages[index];

      this.processedPackagesSignal.update(pkgs =>
        pkgs.filter((_, i) => i !== index)
      );


      this.deletedPackagesSignal.update(arr => [...arr, deletedPackage]);

      if (deletedPackage.originalColor) {
        this.releaseColor(deletedPackage.originalColor);
      }

      if (deletedPackage.mesh) {
        this.packagesGroup.remove(deletedPackage.mesh);
        deletedPackage.mesh.geometry.dispose();
        (deletedPackage.mesh.material as THREE.Material).dispose();
      }

      this.selectedPackageSignal.set(null);
      this.orderResultChange();
      this.renderManager.requestRender();
    }
  }

  restorePackage(packageData: PackageData): void {
    this.deletedPackagesSignal.update(arr => arr.filter(pkg => pkg.id !== packageData.id));

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
      this.processedPackagesSignal.update(packages => [...packages, packageData]);
      this.orderResultChange();
      this.renderManager.requestRender();
    } else {
      this.deletedPackagesSignal.update(arr => [...arr, packageData]);
    }
  }

  restoreAllPackages(): void {
    const deleted = this.deletedPackagesSignal();
    if (deleted.length === 0) return;
    const packagesToRestore = [...deleted];
    packagesToRestore.forEach(pkg => this.restorePackage(pkg));
  }

  clearDeletedPackages(): void {
    this.deletedPackagesSignal.set([]);
  }

  private recreatePackageMesh(packageData: PackageData): void {
    if (packageData.mesh) {
      const material = packageData.mesh.material as THREE.MeshLambertMaterial;
      material.emissive.setHex(0x000000);

      this.packagesGroup.remove(packageData.mesh);
      packageData.mesh.geometry.dispose();
      material.dispose();
      packageData.mesh = undefined;
    }

    this.createPackageMesh(packageData);
  }

  private findValidPosition(packageData: PackageData): { x: number, y: number, z: number } | null {
    if (!this.checkCollisionPrecise(packageData, {
      x: packageData.x,
      y: packageData.y,
      z: packageData.z
    })) {
      return { x: packageData.x, y: packageData.y, z: packageData.z };
    }

    const truckDims = this.truckDimension();
    const stepSize = 100;

    for (let x = 0; x <= truckDims[0] - packageData.length; x += stepSize) {
      for (let y = 0; y <= truckDims[1] - packageData.width; y += stepSize) {
        const testPosition = { x, y, z: 0 };
        if (!this.checkCollisionPrecise(packageData, testPosition)) {
          return testPosition;
        }
      }
    }

    return null;
  }

  // ========================================
  // VIEW CONTROLS
  // ========================================

  setView(viewType: string): void {
    this.currentView = viewType;
    const truckDims = this.truckDimension();

    this.cameraTarget.set(
      truckDims[0] / 2,
      truckDims[2] / 2,
      truckDims[1] / 2
    );

    const maxDim = Math.max(...truckDims);
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
    this.renderManager.requestRender();
  }

  resetView(): void {
    this.zoomLevel = 100;
    this.setView('isometric');
  }

  // ========================================
  // WEIGHT CALCULATION
  // ========================================

  get frontSectionWeight(): number {
    const packages = this.processedPackagesSignal();
    if (!packages || packages.length === 0) {
      return 0;
    }

    return this.processedPackagesSignal().reduce((total, pkg) => {
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
  // COLLISION WARNING
  // ========================================

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

  // ========================================
  // HOST LISTENERS
  // ========================================

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (this.isDragging) return;

    switch (event.key) {
      case 'r':
      case 'R':
        if (this.selectedPackageSignal()) {
          event.preventDefault();
          this.rotateSelectedPackage();
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (this.selectedPackageSignal()) {
          event.preventDefault();
          this.deleteSelectedPackage();
        }
        break;

      case 'Escape':
        if (this.selectedPackageSignal()) {
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
      this.renderManager.requestRender();
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  trackDeletedPackage(index: number, item: PackageData): any {
    return item.id;
  }

  private orderResultChange(): void {
    if (!this.isDirty()) {
      this.ngZone.run(() => {
        this.store.dispatch(StepperUiActions.setStep3IsDirty());
      });
    }
  }

  // ========================================
  // CLEANUP
  // ========================================

  private cleanup(): void {
    console.log('[Component] Cleanup başlatılıyor...');

    this.isDragging = false;
    this.isRotatingCamera = false;
    this.isPanningCamera = false;

    if (this.hoverThrottleTimeout) {
      clearTimeout(this.hoverThrottleTimeout);
      this.hoverThrottleTimeout = null;
    }

    // Stop render loop
    this.renderManager.cleanup();

    // Cleanup Three.js resources
    if (this.threeComponents) {
      this.initService.cleanup(this.threeComponents);
    }

    // Dispose packages
    this.processedPackagesSignal().forEach(pkg => {
      if (pkg.mesh) {
        pkg.mesh.geometry.dispose();
        (pkg.mesh.material as THREE.Material).dispose();
      }
    });

    this.usedColors.clear();

    console.log('[Component] Cleanup tamamlandı');
  }
}
