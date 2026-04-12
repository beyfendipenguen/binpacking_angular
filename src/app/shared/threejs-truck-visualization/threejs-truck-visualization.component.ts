import {
  Component,
  ElementRef,
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { Store } from '@ngrx/store';
import { AppState, selectOrderResult, selectPackages, selectStep3IsDirty, selectTruck, selectUserPermissions, StepperResultActions } from '../../store';
import { StepperUiActions } from '@app/store/stepper/actions/stepper-ui.actions';
import { ThreeJSRenderManagerService } from './services/threejs-render-manager.service';
import { ThreeJSComponents, ThreeJSInitializationService } from './services/threejs-initialization.service';
import { PackagesStateService } from './services/packages-state.service';
import { PackageData, PackageSnapshot } from '@app/features/interfaces/order-result.interface';
import { toObservable } from '@angular/core/rxjs-interop';
import { skip, distinctUntilChanged, takeUntil, Subject } from 'rxjs';
import { ToastService } from '@app/core/services/toast.service';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';



@Component({
  selector: 'app-threejs-truck-visualization',
  standalone: true,
  imports: [CommonModule, FormsModule,
    TranslateModule,
        DisableAuthDirective
  ],
  templateUrl: './threejs-truck-visualization.component.html',
  styleUrl: './threejs-truck-visualization.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThreeJSTruckVisualizationComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('threeContainer', { static: true }) threeContainer!: ElementRef;

  showHelp: boolean = true;
  isFullscreen = false;
  showWeightDisplay: boolean = true;
  weightCalculationDepth: number = 3000;
  private resizeObserver?: ResizeObserver;
  private destroy$ = new Subject<void>();
  // Services
  private readonly store = inject(Store<AppState>);
  private readonly renderManager = inject(ThreeJSRenderManagerService);
  private readonly initService = inject(ThreeJSInitializationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly translate = inject(TranslateService);
  private readonly packagesStateService = inject(PackagesStateService);
  private readonly toastService = inject(ToastService);

  // Signals
  truckDimension = this.store.selectSignal(selectTruck);
  isDirty = this.store.selectSignal(selectStep3IsDirty);
  piecesDataSignal = this.store.selectSignal(selectOrderResult);
  isLoadingSignal = signal(true);
  isDataLoadingSignal = signal(false);
  deletedPackagesSignal = this.packagesStateService.deletedPackages;
  processedPackagesSignal = this.packagesStateService.processedPackages;
  selectedPackageSignal = this.packagesStateService.selectedPackage;
  packagesSignal = this.store.selectSignal(selectPackages);
  private piecesData$ = toObservable(this.piecesDataSignal);
  private permissions = this.store.selectSignal(selectUserPermissions);

  // Three.js components
  private threeComponents?: ThreeJSComponents;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private packagesGroup!: THREE.Group;

  // Touch support
  private activeTouches: Map<number, Touch> = new Map();
  private lastTouchDistance = 0;
  private lastTouchAngle = 0;
  private isTouchDragging = false;
  private isTouchRotating = false;
  private touchStartTime = 0;
  private touchMoved = false;
  private isLocalOperation = false;

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

  // Undo/Redo
  private undoStack: PackageSnapshot[][] = [];
  private redoStack: PackageSnapshot[][] = [];
  private readonly MAX_HISTORY = 30;
  canUndo = signal(false);
  canRedo = signal(false);

  // Data

  currentFPS = 60;

  // Color management
  private readonly COLOR_PALETTE = [
  '#D32F2F', // kırmızı
  '#1976D2', // mavi
  '#388E3C', // yeşil
  '#F57C00', // turuncu
  '#7B1FA2', // mor
  '#0097A7', // cyan
  '#FBC02D', // sarı
  '#C2185B', // pembe
  '#00796B', // teal
  '#455A64', // mavi gri
  '#E64A19', // derin turuncu
  '#1565C0', // koyu mavi
  '#2E7D32', // koyu yeşil
  '#AD1457', // koyu pembe
  '#6A1B9A', // koyu mor
  '#00838F', // koyu cyan
  '#F9A825', // koyu sarı
  '#4E342E', // kahve
  '#37474F', // antrasit
  '#558B2F', // ordu yeşili
];

  private usedColors = new Set<string>();

  // Throttles
  private hoverThrottleTimeout: any = null;

  constructor() { }

  ngOnInit(): void {
    this.isLoadingModels = true;
    this.isLoadingSignal.set(true);

    this.packagesStateService.setOnPackageRemovedCallback((pkg) => {
      this.cleanupMesh(pkg);
    });

    this.packagesStateService.setOnPackageAddedCallback((pkg) => {
      if (!pkg.mesh && this.isViewReady) {
        this.createPackageMesh(pkg);
        this.renderManager.requestRender();
      }
    });

    // Artık hazır observable'ı kullan
    this.piecesData$
      .pipe(
        skip(1),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((pieces) => {
        if (this.isLocalOperation) {
          this.isLocalOperation = false; // ← Burada sıfırla, setTimeout yok
          return;
        }
        if (this.isViewReady && pieces && pieces.length > 0) {
          this.safeProcessData();
        }
      });
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
  }

  private hasChangePerm(): boolean {
    return this.permissions()?.includes('orders.change_orderresult') ?? false;
  }

    /**
   * Package mesh'ini temizler
   */
  private cleanupMesh(pkg: PackageData): void {

    if (pkg.mesh) {
      this.packagesGroup.remove(pkg.mesh);
      pkg.mesh.geometry.dispose();
      (pkg.mesh.material as THREE.Material).dispose();
      pkg.mesh = undefined;
    }

    if (pkg.forcePlaceBorder) {
      pkg.forcePlaceBorder.geometry.dispose();
      (pkg.forcePlaceBorder.material as THREE.Material).dispose();
      pkg.forcePlaceBorder = undefined;
    }

    if (pkg.originalColor) {
      this.releaseColor(pkg.originalColor);
    }

    this.renderManager.requestRender();
  }


  async ngAfterViewInit(): Promise<void> {
    try {
      await this.initializeThreeJS();

      // ResizeObserver: setTimeout hack yerine güvenilir boyut takibi
      this.resizeObserver = new ResizeObserver(() => {
        this.ngZone.runOutsideAngular(() => this.onWindowResize());
      });
      this.resizeObserver.observe(this.threeContainer.nativeElement);

    } catch (error) {
      this.hasThreeJSError = true;
      this.isLoadingSignal.set(false);
      this.cdr.detectChanges();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isDestroyed || !this.isViewReady) return;
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    this.resizeObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.isDestroyed = true;
    this.cleanup();
  }

  //distane calculation
  get selectedPackageDistanceToEnd(): number {
    const selected = this.selectedPackageSignal();
    if (!selected) return 0;

    const truckLength = this.truckDimension()[0];
    return truckLength - (selected.x + selected.length);
  }

  get selectedPackageProducts(): any[] {
    const selected = this.selectedPackageSignal();
    if (!selected) return [];

    const packages = this.packagesSignal();
    const matchedPackage = Object.values(packages).find(
      (pkg: any) => pkg.id === selected.pkgId
    );

    return matchedPackage?.package_details || [];
  }

  get selectedPackageDistanceToEndDisplay(): string {
    const distance = this.selectedPackageDistanceToEnd;
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(2)} m`;
    }
    return `${distance.toFixed(0)} mm`;
  }

  // Zorla yerleştir
  forcePlacePackage(): void {
    const selected = this.selectedPackageSignal();
    if (!selected?.mesh) return;

    this.saveSnapshot();

    // Flag'i set et
    selected.isForcePlaced = true;

    // Görsel feedback - Kalın siyah border
    this.addForcePlaceBorder(selected);

    // Hafif glow ekle
    const material = selected.mesh.material as THREE.MeshStandardMaterial;
    material.emissive.setHex(0x222222);

    this.orderResultChange();
    this.renderManager.requestRender();
    this.cdr.detectChanges();
  }

  // Normal hale getir
  unforcePlacePackage(): void {
    const selected = this.selectedPackageSignal();
    if (!selected?.mesh) return;

    // Flag'i kaldır
    selected.isForcePlaced = false;

    // Border'ı kaldır
    this.removeForcePlaceBorder(selected);

    // Glow'u kaldır
    const material = selected.mesh.material as THREE.MeshStandardMaterial;
    material.emissive.setHex(0x000000);

    this.orderResultChange();
    this.renderManager.requestRender();
    this.cdr.detectChanges();
  }

  // Border ekleme
  getWeightTitle(): string {
    const firstText = this.translate.instant('TRUCK_VISUALIZATION.FIRST');
    const totalWeightText = this.translate.instant('PALLET_CONTROL.TOTAL_WEIGHT');
    const depth = (this.weightCalculationDepth / 1000).toFixed(1);
    return `${firstText} ${depth}m ${totalWeightText}`;
  }

  private addForcePlaceBorder(packageData: PackageData): void {
    if (!packageData.mesh || packageData.forcePlaceBorder) return;

    const geometry = packageData.mesh.geometry;
    const edges = new THREE.EdgesGeometry(geometry);

    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,      // Siyah
      linewidth: 4,         // Kalın
      transparent: true,
      opacity: 1.0
    });

    const border = new THREE.LineSegments(edges, borderMaterial);
    packageData.forcePlaceBorder = border;
    packageData.mesh.add(border);
  }

  // Border kaldırma
  private removeForcePlaceBorder(packageData: PackageData): void {
    if (!packageData.mesh || !packageData.forcePlaceBorder) return;

    packageData.mesh.remove(packageData.forcePlaceBorder);
    packageData.forcePlaceBorder.geometry.dispose();
    (packageData.forcePlaceBorder.material as THREE.Material).dispose();
    packageData.forcePlaceBorder = undefined;
  }

  //end



  // ========================================
  // INITIALIZATION
  // ========================================

  private async initializeThreeJS(): Promise<void> {
    try {
      this.isLoadingModels = true;
      this.isLoadingSignal.set(true);

      const container = this.threeContainer.nativeElement;
      const truckDims = this.truckDimension();

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
        truckDims[2] / 2 + 1100,
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
      this.modelsLoaded.truck = false;
      this.modelsLoaded.trailerWheel = true;

      // Loading complete
      this.isLoadingModels = false;
      this.isLoadingSignal.set(false);
      this.isViewReady = true;

      // Force initial render
      this.renderManager.requestRender();

      // Process data if available
      if (this.piecesDataSignal() && (Array.isArray(this.piecesDataSignal()) ? this.piecesDataSignal().length > 0 : true)) {
        await this.safeProcessData();
      }

      this.cdr.detectChanges();

    } catch (error) {
      this.hasThreeJSError = true;
      this.isLoadingSignal.set(false);
      throw error;
    }
  }

  // ========================================
  // DATA PROCESSING
  // ========================================

  public async safeProcessData(): Promise<void> {

    if (this.isDestroyed || !this.isViewReady) return;

    this.isLoadingData = true;
    this.isDataLoadingSignal.set(true);

    try {
      this.processData();
      this.createPackageVisualization();

      this.renderManager.requestRender();
    } catch (error) {
      this.toastService.error(this.translate.instant('ERROR_PAGE.UNKNOWN_ERROR'));
    } finally {
      this.isLoadingData = false;
      this.isDataLoadingSignal.set(false);

      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    }
  }

  private processData(): void {
    const pieces = this.piecesDataSignal();

    if (!pieces || pieces.length === 0) {
      this.packagesStateService.clearDeletedPackages()
      this.packagesStateService.clearProcessedPackages()
      this.usedColors.clear();
      return;
    }

    // Mevcut state'i koruyarak process et
    const stateMap = new Map();
    this.processedPackagesSignal().forEach(pkg => {
      stateMap.set(pkg.pkgId, {
        color: pkg.color,
        originalColor: pkg.originalColor,
        rotation: pkg.rotation || 0,
        originalLength: pkg.originalLength,
        originalWidth: pkg.originalWidth,
        isForcePlaced: pkg.isForcePlaced || false // ⭐ State'i koru
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
        dimensions: `${length}×${width}×${piece[5] || 0} mm`,
        isBeingDragged: false,
        pkgId: piece[8],
        isForcePlaced: saved?.isForcePlaced || false
      };

      if (piece[0] === -1 && piece[1] === -1 && piece[2] === -1) {
        deleted.push(pkg);

      } else {
        processed.push(pkg);
      }
    });

    if (processed.length !== 0) {
      this.packagesStateService.setProcessedPackages(processed);
    }

    if (deleted.length !== 0) {
      this.packagesStateService.setDeletedPackages(deleted);
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
    const { group: palletGroup, palletHeight } = this.createPalletMesh(packageData.length, packageData.width);

    const visualHeight = packageData.height - palletHeight;

    const geometry = new THREE.BoxGeometry(
      packageData.length,
      visualHeight,
      packageData.width
    );

    // Geometry'yi palet kadar yukarı kaydır (mesh position değişmez)

    const material = new THREE.MeshStandardMaterial({
      color: packageData.color,
      roughness: 0.65,
      metalness: 0.01,
      wireframe: this.wireframeMode
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      packageData.x + packageData.length / 2,
      packageData.z + palletHeight + visualHeight / 2, // palet + kutunun yarısı
      packageData.y + packageData.width / 2
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { packageData };

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.20
    });
    mesh.add(new THREE.LineSegments(edges, lineMat));

    // Palet mesh merkezine göre tam alta
    palletGroup.position.set(
      -packageData.length / 2,
      -packageData.height / 2 - palletHeight/2,  // mesh merkezinden palet tabanına
      -packageData.width / 2
    );
    mesh.add(palletGroup);

    packageData.mesh = mesh;

    if (packageData.isForcePlaced) {
      this.addForcePlaceBorder(packageData);
    }

    this.packagesGroup.add(mesh);
  }

  // =============================================================================
  // 2. createPalletMesh — YENİ METOD (createPackageMesh'in hemen altına ekle)
  //
  //    Anatomisi:
  //    ┌─┬─┬─┬─┬─┬─┬─┐  ← 7 üst tahta (lengthwise)
  //    █   █   █      ← 9 destek bloğu (3×3 grid)
  //    ══  ══  ══     ← 3 alt kızak (lengthwise)
  //
  //    Tüm boyutlar pakete göre orantılı hesaplanıyor.
  //    Fizik/collision'a dokunmuyor — tamamen görsel.
  // =============================================================================

  private createPalletMesh(pkgLength: number, pkgWidth: number): { group: THREE.Group, palletHeight: number } {
    const group = new THREE.Group();

    // --- Boyutlar ---
    const BOARD_THICK = Math.max(18, pkgWidth * 0.018); // üst/alt tahta kalınlığı
    const BLOCK_H = Math.max(70, pkgLength * 0.045); // blok yüksekliği
    const PALLET_H = BOARD_THICK * 2 + BLOCK_H;       // toplam palet yüksekliği ~140mm
    const BOARD_GAP = pkgWidth * 0.03;                 // tahtalar arası boşluk
    const BOARD_COUNT = 7;
    const BLOCK_W = Math.min(pkgLength * 0.10, 120); // blok eni

    // --- Malzemeler ---
    // İki ton ahşap rengi — alternating board rengi gerçekçilik katar
    const matLight = new THREE.MeshStandardMaterial({
      color: 0xC4A265, roughness: 0.92, metalness: 0.0
    });
    const matDark = new THREE.MeshStandardMaterial({
      color: 0xA07840, roughness: 0.95, metalness: 0.0
    });

    // --- Yardımcı: mesh oluştur ve sahneye ekle ---
    const addBoard = (
      w: number, h: number, d: number,
      x: number, y: number, z: number,
      mat: THREE.MeshStandardMaterial
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    // ── 1. ÜST TAHTALAR ─────────────────────────────────────────────────────
    // 7 tahta, Z ekseninde eşit aralıklı, length boyunca uzanıyor
    const totalGap = BOARD_GAP * (BOARD_COUNT - 1);
    const boardDepth = (pkgWidth - totalGap) / BOARD_COUNT;
    const topY = PALLET_H - BOARD_THICK / 2; // palet tepesi

    for (let i = 0; i < BOARD_COUNT; i++) {
      const zPos = boardDepth / 2 + i * (boardDepth + BOARD_GAP);
      addBoard(
        pkgLength, BOARD_THICK, boardDepth,
        pkgLength / 2, topY, zPos,
        i % 2 === 0 ? matLight : matDark
      );
    }

    // ── 2. ORTA DESTEK BLOKLARI ──────────────────────────────────────────────
    // 3×3 grid — hem X hem Z ekseninde 3 sıra
    const blockXPositions = [pkgLength * 0.12, pkgLength * 0.50, pkgLength * 0.88];
    const blockZPositions = [pkgWidth * 0.12, pkgWidth * 0.50, pkgWidth * 0.88];
    const blockY = BOARD_THICK + BLOCK_H / 2;

    for (const bx of blockXPositions) {
      for (const bz of blockZPositions) {
        addBoard(
          BLOCK_W, BLOCK_H, BLOCK_W,
          bx, blockY, bz,
          matDark
        );
      }
    }

    // ── 3. ALT KIZAKLAR ──────────────────────────────────────────────────────
    // 3 kızak, length boyunca uzanıyor, Z ekseninde blok hizasında
    const runnerW = BLOCK_W * 1.1; // bloktan biraz geniş
    const runnerY = BOARD_THICK / 2;

    for (const rz of blockZPositions) {
      addBoard(
        pkgLength, BOARD_THICK, runnerW,
        pkgLength / 2, runnerY, rz,
        matLight
      );
    }

    // Palet grubunun origin'i palet tabanı (y=0) → üst yüzeyi y=PALLET_H
    // createPackageMesh'te palet.position.y = -packageData.height/2 yapıldığında
    // palet üstü paketin tabanına tam yaslanır

    return { group, palletHeight: PALLET_H };
  }

  // ========================================
  // MOUSE EVENTS
  // ========================================

  private setupMouseEvents(): void {
    const canvas = this.renderer.domElement;

    // Mouse events
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

    // Touch events
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();

    // Touch'ları kaydet
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeTouches.set(touch.identifier, touch);
    }

    const touchCount = this.activeTouches.size;

    if (touchCount === 1) {
      // Tek parmak: sürükleme veya seçim
      const touch = event.touches[0];
      this.touchStartTime = Date.now();
      this.touchMoved = false;
      this.updateMouseFromTouch(touch);

      const intersectedPackage = this.getIntersectedPackage();
      if (intersectedPackage && this.dragModeEnabled  && this.hasChangePerm()) {
        this.isTouchDragging = true;
        this.initiateDragging(intersectedPackage);
      }
    } else if (touchCount === 2) {
      // İki parmak: kamera döndürme veya pinch zoom
      // Eğer sürükleme varsa iptal et
      if (this.isTouchDragging) {
        this.cancelDragging();
        this.isTouchDragging = false;
      }

      this.isTouchRotating = true;
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      this.lastTouchDistance = this.getTouchDistance(t1, t2);
      this.lastTouchAngle = this.getTouchAngle(t1, t2);
      this.lastMouseX = (t1.clientX + t2.clientX) / 2;
      this.lastMouseY = (t1.clientY + t2.clientY) / 2;
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    this.touchMoved = true;

    // Touch'ları güncelle
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      this.activeTouches.set(touch.identifier, touch);
    }

    const touchCount = event.touches.length;

    if (touchCount === 1 && this.isTouchDragging && this.isDragging) {
      // Tek parmak sürükleme
      this.updateMouseFromTouch(event.touches[0]);
      this.updateDraggedPackageWithSnapping();
      this.renderManager.requestRender();
    } else if (touchCount === 1 && !this.isTouchDragging) {
      // Tek parmak kamera döndürme (paket tutulmadıysa)
      const touch = event.touches[0];
      const deltaX = (touch.clientX - this.lastMouseX) * 0.005;
      const deltaY = (touch.clientY - this.lastMouseY) * 0.005;
      this.rotateViewAroundTarget(deltaX, deltaY);
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
      this.renderManager.requestRender();
    } else if (touchCount === 2) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];

      // Pinch zoom
      const currentDistance = this.getTouchDistance(t1, t2);
      if (this.lastTouchDistance > 0) {
        const scale = currentDistance / this.lastTouchDistance;
        const zoomDelta = (1 - scale) * 5;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + zoomDelta));
        this.setZoomLevelPreserveTarget(newZoom);
      }
      this.lastTouchDistance = currentDistance;

      // İki parmak pan
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const panDeltaX = midX - this.lastMouseX;
      const panDeltaY = midY - this.lastMouseY;

      if (Math.abs(panDeltaX) > 1 || Math.abs(panDeltaY) > 1) {
        const distance = this.camera.position.distanceTo(this.cameraTarget);
        const panSensitivity = distance * 0.001;

        const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const cameraUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);

        const panOffset = new THREE.Vector3();
        panOffset.add(cameraRight.multiplyScalar(-panDeltaX * panSensitivity));
        panOffset.add(cameraUp.multiplyScalar(panDeltaY * panSensitivity));

        this.camera.position.add(panOffset);
        this.cameraTarget.add(panOffset);
      }

      this.lastMouseX = midX;
      this.lastMouseY = midY;
      this.renderManager.requestRender();
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();

    // Biten touch'ları kaldır
    for (let i = 0; i < event.changedTouches.length; i++) {
      this.activeTouches.delete(event.changedTouches[i].identifier);
    }

    const touchCount = event.touches.length;

    if (touchCount === 0) {
      const clickDuration = Date.now() - this.touchStartTime;

      // Sürükleme bittiyse
      if (this.isDragging) {
        this.completeDragging();
      }

      // Tap = seçim (kısa dokunuş, hareket etmediyse)
      if (!this.touchMoved && clickDuration < 300 && !this.isTouchDragging) {
        const intersectedPackage = this.getIntersectedPackage();
        if (intersectedPackage) {
          this.selectPackage(intersectedPackage.pkgId);
        } else {
          this.clearSelection();
        }
      }

      // Reset
      this.isTouchDragging = false;
      this.isTouchRotating = false;
      this.lastTouchDistance = 0;
      this.activeTouches.clear();
    } else if (touchCount === 1) {
      // 2 parmaktan 1'e düştü, kamera döndürmeyi durdur
      this.isTouchRotating = false;
      this.lastTouchDistance = 0;
      this.lastMouseX = event.touches[0].clientX;
      this.lastMouseY = event.touches[0].clientY;
    }
  }

  private updateMouseFromTouch(touch: Touch): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchAngle(t1: Touch, t2: Touch): number {
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
  }

  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();

    this.mouseDownTime = Date.now();
    this.mouseMoved = false;
    this.updateMouseCoordinates(event);

    if (event.button === 0) {
      // Left click - package drag
      const intersectedPackage = this.getIntersectedPackage();
      if (intersectedPackage && this.dragModeEnabled && this.hasChangePerm()) {
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
      this.selectPackage(intersectedPackage.pkgId);
    } else {
      this.clearSelection();
    }
  }

  /**
 * Tüm paketlere gravity uygula - boşlukta kalanları indir
 */
  private applyGravityToAllPackages(): void {
    // Tüm paketleri Z yüksekliğine göre sırala (alttakiler önce işlensin)
    const sortedPackages = [...this.processedPackagesSignal()].sort((a, b) => a.z - b.z);

    let changed = false;

    for (const pkg of sortedPackages) {
      // ⭐ Force placed package'lara da gravity uygula (drag bitince)
      const lowestZ = this.findLowestValidZ(pkg);

      if (lowestZ < pkg.z) {
        pkg.z = lowestZ;
        if (pkg.mesh) {
          pkg.mesh.position.y = lowestZ + pkg.height / 2;
        }
        changed = true;
      }
    }

    if (changed) {
      this.orderResultChange();
      this.renderManager.requestRender();
      this.cdr.detectChanges();
    }
  }

  /**
   * Package için en düşük geçerli Z pozisyonunu bul
   */
  private findLowestValidZ(pkg: PackageData): number {
    let lowestZ = 0; // Ground level

    for (const otherPkg of this.processedPackagesSignal()) {
      if (otherPkg.pkgId === pkg.pkgId) continue;

      // X ve Y overlap var mı?
      const xOverlap = pkg.x < otherPkg.x + otherPkg.length &&
        pkg.x + pkg.length > otherPkg.x;
      const yOverlap = pkg.y < otherPkg.y + otherPkg.width &&
        pkg.y + pkg.width > otherPkg.y;

      if (xOverlap && yOverlap) {
        // Bu package'ın üstünde olmalı
        const potentialZ = otherPkg.z + otherPkg.height;
        lowestZ = Math.max(lowestZ, potentialZ);
      }
    }

    return lowestZ;
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    // ✅ Shift + Scroll = Z-axis hareket (drag ederken)
    if (this.isDragging && this.draggedPackage && event.shiftKey) {
      const zStep = 100; // Her scroll'da 100mm
      const delta = event.deltaY > 0 ? -zStep : zStep; // Ters yön (doğal hissetmesi için)

      const newZ = Math.max(0, this.draggedPackage.z + delta);
      const truckHeight = this.truckDimension()[2];

      // Truck height kontrolü
      if (newZ + this.draggedPackage.height <= truckHeight) {
        this.draggedPackage.z = newZ;

        if (this.draggedPackage.mesh) {
          this.draggedPackage.mesh.position.y = newZ + this.draggedPackage.height / 2;
        }

        this.orderResultChange();
        this.renderManager.requestRender();
      }
      return;
    }

    // Normal zoom (mevcut kod)
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

    this.camera.updateMatrixWorld();

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

      // ✅ Her zaman ground level'da plane
      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0)
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

      // Truck sınırları (mevcut)
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

        // Mevcut data pozisyonu (collision olmayan son geçerli pozisyon)
        const currentDataPos = { x: pkg.x, y: pkg.y, z: pkg.z };

        // Hedeflenen pozisyon
        const desiredPos = {
          x: snappedPosition.x - pkg.length / 2,
          y: snappedPosition.z - pkg.width / 2,
          z: snappedPosition.y - pkg.height / 2
        };

        // ========================================
        // SLIDING COLLISION RESPONSE
        // Her ekseni bağımsız kontrol et
        // ========================================

        let finalX = desiredPos.x;
        let finalY = desiredPos.y;
        let finalZ = desiredPos.z;
        let isSliding = false;

        // 1) Önce her iki eksende birden dene
        const bothAxesOk = !this.checkCollisionPrecise(pkg, {
          x: desiredPos.x, y: desiredPos.y, z: desiredPos.z
        });

        if (!bothAxesOk) {
          // 2) Sadece X ekseninde hareket et (Y eski yerinde)
          const xOnlyOk = !this.checkCollisionPrecise(pkg, {
            x: desiredPos.x, y: currentDataPos.y, z: desiredPos.z
          });

          // 3) Sadece Y ekseninde hareket et (X eski yerinde)
          const yOnlyOk = !this.checkCollisionPrecise(pkg, {
            x: currentDataPos.x, y: desiredPos.y, z: desiredPos.z
          });

          finalX = xOnlyOk ? desiredPos.x : currentDataPos.x;
          finalY = yOnlyOk ? desiredPos.y : currentDataPos.y;
          isSliding = true;

          // 4) Tek eksen bile collision yapıyorsa → hiç kıpırdama
          if (!xOnlyOk && !yOnlyOk) {
            finalZ = currentDataPos.z;
          }
        }

        // Mesh pozisyonunu güncelle (center-based)
        const finalMeshPos = new THREE.Vector3(
          finalX + pkg.length / 2,
          finalZ + pkg.height / 2,
          finalY + pkg.width / 2
        );

        pkg.mesh!.position.copy(finalMeshPos);
        this.lastDragPosition.copy(finalMeshPos);

        // Data güncelle
        pkg.x = finalX;
        pkg.y = finalY;
        pkg.z = finalZ;

        // Görsel feedback
        if (isSliding) {
          this.showCollisionWarningBriefly();
          // Kırmızı wireframe — duvara değiyor
          const material = pkg.mesh!.material as THREE.MeshStandardMaterial;
          material.wireframe = true;
          material.emissive.setHex(0xff0000);
        } else {
          this.clearCollisionWarning();
          // Normal drag görünümü
          const material = pkg.mesh!.material as THREE.MeshStandardMaterial;
          material.wireframe = false;
          material.emissive.setHex(0x444444);
        }

        this.orderResultChange();
        this.cdr.markForCheck();
      }
    }
  }

  private completeDragging(): void {
    if (!this.isDragging || !this.draggedPackage) return;
    this.saveSnapshot();

    if (this.draggedPackage.mesh) {
      const material = this.draggedPackage.mesh.material as THREE.MeshStandardMaterial;
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

    // ✅ Gravity uygula
    this.applyGravityToAllPackages();

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
    newPos: { x: number, y: number, z: number },
    packageList?: PackageData[]
  ): boolean {
    if (packageToCheck.isForcePlaced) {
      return false;
    }
    const checkLength = packageToCheck.length;
    const checkWidth = packageToCheck.width;
    const packages = packageList ?? this.processedPackagesSignal();

    for (const otherPackage of packages) {
      if (otherPackage.pkgId === packageToCheck.pkgId) continue;
      if (!packageList && !otherPackage.mesh) continue; // sadece normal modda mesh kontrolü

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

    // En iyi snap'leri bul (en yakın mesafe kazanır)
    let bestSnapX = pkgPos.x;
    let bestSnapY = pkgPos.y;
    let bestSnapDistX = snapThreshold;
    let bestSnapDistY = snapThreshold;
    let snappedZ = pkg.z;

    for (const otherPkg of this.processedPackagesSignal()) {
      if (otherPkg.pkgId === pkg.pkgId || !otherPkg.mesh) continue;

      const otherLeft = otherPkg.x;
      const otherRight = otherPkg.x + otherPkg.length;
      const otherFront = otherPkg.y;
      const otherBack = otherPkg.y + otherPkg.width;

      const pkgRight = pkgPos.x + pkg.length;
      const pkgBack = pkgPos.y + pkg.width;

      // === X-AXIS SNAP ===

      // Bitişik snap: sağ kenar → sol kenar (yanyana dizme)
      const distRightToLeft = Math.abs(pkgRight - otherLeft);
      if (distRightToLeft < bestSnapDistX) {
        bestSnapDistX = distRightToLeft;
        bestSnapX = otherLeft - pkg.length;
      }

      // Bitişik snap: sol kenar → sağ kenar
      const distLeftToRight = Math.abs(pkgPos.x - otherRight);
      if (distLeftToRight < bestSnapDistX) {
        bestSnapDistX = distLeftToRight;
        bestSnapX = otherRight;
      }

      // ⭐ Hizalama snap: sol kenar ↔ sol kenar
      const distLeftToLeft = Math.abs(pkgPos.x - otherLeft);
      if (distLeftToLeft < bestSnapDistX) {
        bestSnapDistX = distLeftToLeft;
        bestSnapX = otherLeft;
      }

      // ⭐ Hizalama snap: sağ kenar ↔ sağ kenar
      const distRightToRight = Math.abs(pkgRight - otherRight);
      if (distRightToRight < bestSnapDistX) {
        bestSnapDistX = distRightToRight;
        bestSnapX = otherRight - pkg.length;
      }

      // ⭐ Hizalama snap: sol kenar ↔ sağ kenar (çapraz hizalama)
      const distLeftToRightEdge = Math.abs(pkgPos.x - otherRight);
      if (distLeftToRightEdge < bestSnapDistX) {
        bestSnapDistX = distLeftToRightEdge;
        bestSnapX = otherRight;
      }

      // ⭐ Hizalama snap: sağ kenar ↔ sol kenar (çapraz hizalama)
      const distRightToLeftEdge = Math.abs(pkgRight - otherLeft);
      if (distRightToLeftEdge < bestSnapDistX) {
        bestSnapDistX = distRightToLeftEdge;
        bestSnapX = otherLeft - pkg.length;
      }

      // === Y-AXIS SNAP ===

      // Bitişik snap: arka → ön
      const distBackToFront = Math.abs(pkgBack - otherFront);
      if (distBackToFront < bestSnapDistY) {
        bestSnapDistY = distBackToFront;
        bestSnapY = otherFront - pkg.width;
      }

      // Bitişik snap: ön → arka
      const distFrontToBack = Math.abs(pkgPos.y - otherBack);
      if (distFrontToBack < bestSnapDistY) {
        bestSnapDistY = distFrontToBack;
        bestSnapY = otherBack;
      }

      // ⭐ Hizalama snap: ön kenar ↔ ön kenar
      const distFrontToFront = Math.abs(pkgPos.y - otherFront);
      if (distFrontToFront < bestSnapDistY) {
        bestSnapDistY = distFrontToFront;
        bestSnapY = otherFront;
      }

      // ⭐ Hizalama snap: arka kenar ↔ arka kenar
      const distBackToBack = Math.abs(pkgBack - otherBack);
      if (distBackToBack < bestSnapDistY) {
        bestSnapDistY = distBackToBack;
        bestSnapY = otherBack - pkg.width;
      }
    }

    // === TRUCK KENARLARINA SNAP ===
    const truckDims = this.truckDimension();

    // Truck sol kenarı (x=0)
    if (Math.abs(bestSnapX) < snapThreshold) {
      const dist = Math.abs(bestSnapX);
      if (dist < bestSnapDistX) {
        bestSnapDistX = dist;
        bestSnapX = 0;
      }
    }

    // Truck sağ kenarı
    const distToTruckRight = Math.abs(bestSnapX + pkg.length - truckDims[0]);
    if (distToTruckRight < snapThreshold && distToTruckRight < bestSnapDistX) {
      bestSnapX = truckDims[0] - pkg.length;
    }

    // Truck ön kenarı (y=0)
    if (Math.abs(bestSnapY) < snapThreshold) {
      const dist = Math.abs(bestSnapY);
      if (dist < bestSnapDistY) {
        bestSnapDistY = dist;
        bestSnapY = 0;
      }
    }

    // Truck arka kenarı
    const distToTruckBack = Math.abs(bestSnapY + pkg.width - truckDims[1]);
    if (distToTruckBack < snapThreshold && distToTruckBack < bestSnapDistY) {
      bestSnapY = truckDims[1] - pkg.width;
    }

    // === Z-AXIS (Dikey stacking) ===
    if (!pkg.isForcePlaced) {
      const truckHeight = truckDims[2];
      let maxZBelow = 0;

      for (const otherPkg of this.processedPackagesSignal()) {
        if (otherPkg.pkgId === pkg.pkgId || !otherPkg.mesh) continue;

        const xOverlap = bestSnapX < otherPkg.x + otherPkg.length &&
          bestSnapX + pkg.length > otherPkg.x;
        const yOverlap = bestSnapY < otherPkg.y + otherPkg.width &&
          bestSnapY + pkg.width > otherPkg.y;

        if (xOverlap && yOverlap) {
          const potentialZ = otherPkg.z + otherPkg.height;
          if (potentialZ + pkg.height <= truckHeight) {
            maxZBelow = Math.max(maxZBelow, potentialZ);
          }
        }
      }

      snappedZ = maxZBelow;
    }

    snappedPos.x = bestSnapX + pkg.length / 2;
    snappedPos.z = bestSnapY + pkg.width / 2;
    snappedPos.y = snappedZ + pkg.height / 2;

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

  private selectPackage(pkgId: string): void {
    this.clearHighlights();
    this.packagesStateService.selectPackage(pkgId)
    this.highlightSelectedPackage();
    this.renderManager.requestRender();
  }

  clearSelection(): void {
    this.packagesStateService.clearSelection();
    this.clearHighlights();
    this.renderManager.requestRender();
  }

  private highlightSelectedPackage(): void {
    this.clearHighlights();
    const selected = this.selectedPackageSignal();
    if (selected?.mesh) {
      const material = selected.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x666666);
    }
  }

  private highlightDraggedPackage(): void {
    if (this.draggedPackage?.mesh) {
      const material = this.draggedPackage.mesh.material as THREE.MeshStandardMaterial;
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
        const material = pkg.mesh.material as THREE.MeshStandardMaterial;
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
        const material = pkg.mesh.material as THREE.MeshStandardMaterial;
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
      if (otherPkg.pkgId === pkg.pkgId || !otherPkg.mesh) continue;

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

    this.saveSnapshot();

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

    this.saveSnapshot();
    this.isLocalOperation = true;
    const deletedPackage = this.processedPackagesSignal()
      .find(pkg => pkg.pkgId === selected.pkgId);

    if (deletedPackage) {
      this.isLocalOperation = true;
      this.packagesStateService.moveToDeleted(deletedPackage.pkgId);
      this.store.dispatch(StepperResultActions.removePackageFromTruck({ pkgId: deletedPackage.pkgId }));
      this.store.dispatch(StepperResultActions.changeDeletedPackageIsRemaining());

      this.packagesStateService.clearSelection();
      this.applyGravityToAllPackages();
      this.orderResultChange();
    }
  }

  restorePackage(packageData: PackageData): void {
    this.saveSnapshot();
    this.isLocalOperation = true; // ← En başa

    this.packagesStateService.removeFromDeletedPackages(packageData.pkgId);

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
        // Boyutları geri al
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
      this.packagesStateService.addToProcessedPackages(packageData);

      this.store.dispatch(StepperResultActions.placePackageInTruck({
        pkgId: packageData.pkgId,
        x: packageData.x,
        y: packageData.y,
        z: packageData.z
      }));
      this.store.dispatch(StepperResultActions.changeDeletedPackageIsRemaining());
      this.orderResultChange();

    } else {
      // Pozisyon bulunamadı — deleted'a geri koy, store'a -1,-1,-1 gönder
      this.packagesStateService.addToDeletedPackages(packageData);

      this.store.dispatch(StepperResultActions.removePackageFromTruck({
        pkgId: packageData.pkgId  // ← placePackageInTruck değil, remove
      }));
      this.store.dispatch(StepperResultActions.changeDeletedPackageIsRemaining());
    }
  }

  clearDeletedPackages(): void {
    this.packagesStateService.clearDeletedPackages();
  }

  private recreatePackageMesh(packageData: PackageData): void {
    const wasForcePlaced = packageData.isForcePlaced;
    const border = packageData.forcePlaceBorder;

    if (packageData.mesh) {
      const material = packageData.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x000000);

      // Border'ı kaldır
      if (border) {
        packageData.mesh.remove(border);
        border.geometry.dispose();
        (border.material as THREE.Material).dispose();
        packageData.forcePlaceBorder = undefined;
      }

      this.packagesGroup.remove(packageData.mesh);
      packageData.mesh.geometry.dispose();
      material.dispose();
      packageData.mesh = undefined;
    }

    this.createPackageMesh(packageData);

    // Border'ı geri ekle
    if (wasForcePlaced) {
      packageData.isForcePlaced = true;
      this.addForcePlaceBorder(packageData);
    }
  }

  /**
 * 3D space'te geçerli pozisyon bul
 * Öncelik: ground level → 1. kat → 2. kat → ...
 */
  private findValidPosition(packageData: PackageData): { x: number, y: number, z: number } | null {
    const truckDims = this.truckDimension();
    const stepSize = 100;

    // ✅ Z seviyelerine göre önceliklendir (ground level önce)
    const maxZ = truckDims[2] - packageData.height;

    for (let z = 0; z <= maxZ; z += stepSize) {
      for (let x = 0; x <= truckDims[0] - packageData.length; x += stepSize) {
        for (let y = 0; y <= truckDims[1] - packageData.width; y += stepSize) {
          const testPosition = { x, y, z };

          // ✅ Support kontrolü - z > 0 ise altında destek olmalı
          if (z > 0 && !this.hasSupport(packageData, testPosition)) {
            continue;
          }

          if (!this.checkCollisionPrecise(packageData, testPosition)) {
            return testPosition;
          }
        }
      }
    }

    return null;
  }

  /**
   * Package'ın altında destek var mı kontrol et
   */
  private hasSupport(pkg: PackageData, pos: { x: number, y: number, z: number }): boolean {
    // Ground level ise her zaman destekli
    if (pos.z === 0) return true;

    const supportThreshold = 10; // 10mm tolerance

    // Altında package var mı kontrol et
    for (const otherPkg of this.processedPackagesSignal()) {
      // X ve Y overlap var mı?
      const xOverlap = pos.x < otherPkg.x + otherPkg.length &&
        pos.x + pkg.length > otherPkg.x;
      const yOverlap = pos.y < otherPkg.y + otherPkg.width &&
        pos.y + pkg.width > otherPkg.y;

      // Tam altında mı? (package'ın üst yüzeyi bu package'ın alt yüzeyine yakın)
      const isDirectlyBelow = Math.abs((otherPkg.z + otherPkg.height) - pos.z) < supportThreshold;

      if (xOverlap && yOverlap && isDirectlyBelow) {
        return true;
      }
    }

    return false;
  }

  // ========================================
  // VIEW CONTROLS
  // ========================================

  setView(viewType: string): void {
    this.currentView = viewType;
    const truckDims = this.truckDimension();

    this.cameraTarget.set(
      truckDims[0] / 2,
      truckDims[2] / 2 + 1100,
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

  toggleFullscreen(): void {
    const container = this.threeContainer.nativeElement.parentElement;

    if (!this.isFullscreen) {
      // Fullscreen'e geç
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    } else {
      // Fullscreen'den çık
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }

  private handleFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;

    // Fullscreen değişince canvas'ı yeniden boyutlandır
    setTimeout(() => {
      this.onWindowResize();
    }, 100);

    this.ngZone.run(() => {
      this.cdr.detectChanges();
    });
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
        const material = this.draggedPackage.mesh.material as THREE.MeshStandardMaterial;
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
      const material = this.draggedPackage.mesh.material as THREE.MeshStandardMaterial;
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
      case 'f':
      case 'F':
        event.preventDefault();
        this.toggleFullscreen();
        break;

      case 'r':
      case 'R':
        if (this.selectedPackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          this.rotateSelectedPackage();
        }
        break;

      case 'Delete':
      case 'Backspace':
      case 'd':
      case 'D':
        if (this.selectedPackageSignal() && this.hasChangePerm()) {
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
      case 'z':
      case 'Z':
        if ((event.ctrlKey || event.metaKey)  && this.hasChangePerm()) {
          event.preventDefault();
          this.undo();
        }
        break;

      case 'y':
      case 'Y':
        if ((event.ctrlKey || event.metaKey) && this.hasChangePerm()) {
          event.preventDefault();
          this.redo();
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
      this.renderer.setSize(width, height, false); // false → CSS'i override etme
      this.renderManager.requestRender();
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  trackDeletedPackage(index: number, item: PackageData): any {
    return item.pkgId;
  }

  private orderResultChange(): void {
    if (!this.isDirty()) {
      this.ngZone.run(() => {
        this.store.dispatch(StepperUiActions.setStep3IsDirty());
      });
    }
  }

  // ========================================
  // UNDO / REDO
  // ========================================

  private saveSnapshot(): void {
    const all: PackageSnapshot[] = [
      ...this.processedPackagesSignal().map(p => ({
        pkgId: p.pkgId,
        id: p.id,
        x: p.x, y: p.y, z: p.z,
        length: p.length, width: p.width, height: p.height,
        weight: p.weight,
        color: p.color, originalColor: p.originalColor,
        rotation: p.rotation || 0,
        originalLength: p.originalLength || p.length,
        originalWidth: p.originalWidth || p.width,
        dimensions: p.dimensions,
        isForcePlaced: p.isForcePlaced || false,
        isDeleted: false
      })),
      ...this.deletedPackagesSignal().map(p => ({
        pkgId: p.pkgId,
        id: p.id,
        x: p.x, y: p.y, z: p.z,
        length: p.length, width: p.width, height: p.height,
        weight: p.weight,
        color: p.color, originalColor: p.originalColor,
        rotation: p.rotation || 0,
        originalLength: p.originalLength || p.length,
        originalWidth: p.originalWidth || p.width,
        dimensions: p.dimensions,
        isForcePlaced: p.isForcePlaced || false,
        isDeleted: true
      }))
    ];

    this.undoStack.push(all);
    if (this.undoStack.length > this.MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(false);
  }

  private applySnapshot(snapshot: PackageSnapshot[]): void {
    // Mevcut mesh'leri temizle
    this.packagesGroup.clear();
    this.processedPackagesSignal().forEach(p => {
      if (p.mesh) {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        p.mesh = undefined;
      }
      if (p.forcePlaceBorder) {
        p.forcePlaceBorder.geometry.dispose();
        (p.forcePlaceBorder.material as THREE.Material).dispose();
        p.forcePlaceBorder = undefined;
      }
    });

    this.packagesStateService.clearProcessedPackages();
    this.packagesStateService.clearDeletedPackages();
    this.packagesStateService.clearSelection();
    this.usedColors.clear();

    const processed: PackageData[] = [];
    const deleted: PackageData[] = [];

    for (const snap of snapshot) {
      const pkg: PackageData = {
        pkgId: snap.pkgId,
        id: snap.id,
        x: snap.x, y: snap.y, z: snap.z,
        length: snap.length, width: snap.width, height: snap.height,
        weight: snap.weight,
        color: snap.color, originalColor: snap.originalColor,
        rotation: snap.rotation,
        originalLength: snap.originalLength,
        originalWidth: snap.originalWidth,
        dimensions: snap.dimensions,
        isForcePlaced: snap.isForcePlaced,
        isBeingDragged: false
      };

      if (pkg.color) this.usedColors.add(pkg.color);

      if (snap.isDeleted) {
        deleted.push(pkg);
      } else {
        this.createPackageMesh(pkg);
        processed.push(pkg);
      }
    }

    this.packagesStateService.setProcessedPackages(processed);
    if (deleted.length > 0) {
      this.packagesStateService.setDeletedPackages(deleted);
    }

    this.orderResultChange();
    this.renderManager.requestRender();
    this.cdr.markForCheck();
  }

  undo(): void {
    if (this.undoStack.length === 0) return;

    // Mevcut state'i redo'ya kaydet
    const current: PackageSnapshot[] = [
      ...this.processedPackagesSignal().map(p => ({
        pkgId: p.pkgId, id: p.id,
        x: p.x, y: p.y, z: p.z,
        length: p.length, width: p.width, height: p.height,
        weight: p.weight,
        color: p.color ?? '',
        originalColor: p.originalColor ?? '',
        rotation: p.rotation || 0,
        originalLength: p.originalLength || p.length,
        originalWidth: p.originalWidth || p.width,
        dimensions: p.dimensions,
        isForcePlaced: p.isForcePlaced || false,
        isDeleted: false
      })),
      ...this.deletedPackagesSignal().map(p => ({
        pkgId: p.pkgId, id: p.id,
        x: p.x, y: p.y, z: p.z,
        length: p.length, width: p.width, height: p.height,
        weight: p.weight,
        color: p.color ?? '',
        originalColor: p.originalColor ?? '',
        rotation: p.rotation || 0,
        originalLength: p.originalLength || p.length,
        originalWidth: p.originalWidth || p.width,
        dimensions: p.dimensions,
        isForcePlaced: p.isForcePlaced || false,
        isDeleted: true
      }))
    ];
    this.redoStack.push(current);

    const snapshot = this.undoStack.pop()!;
    this.applySnapshot(snapshot);

    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  redo(): void {
    if (this.redoStack.length === 0) return;

    // Mevcut state'i undo'ya kaydet
    const current: PackageSnapshot[] = [
      ...this.processedPackagesSignal().map(p => ({
        pkgId: p.pkgId, id: p.id,
        x: p.x, y: p.y, z: p.z,
        length: p.length, width: p.width, height: p.height,
        weight: p.weight,
        color: p.color ?? '',
        originalColor: p.originalColor ?? '',
        rotation: p.rotation || 0,
        originalLength: p.originalLength || p.length,
        originalWidth: p.originalWidth || p.width,
        dimensions: p.dimensions,
        isForcePlaced: p.isForcePlaced || false,
        isDeleted: false
      })),
      ...this.deletedPackagesSignal().map(p => ({
        pkgId: p.pkgId, id: p.id,
        x: p.x, y: p.y, z: p.z,
        length: p.length, width: p.width, height: p.height,
        weight: p.weight,
        color: p.color ?? '',
        originalColor: p.originalColor ?? '',
        rotation: p.rotation || 0,
        originalLength: p.originalLength || p.length,
        originalWidth: p.originalWidth || p.width,
        dimensions: p.dimensions,
        isForcePlaced: p.isForcePlaced || false,
        isDeleted: true
      }))
    ];
    this.undoStack.push(current);

    const snapshot = this.redoStack.pop()!;
    this.applySnapshot(snapshot);

    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  // ========================================
  // CLEANUP
  // ========================================

  private cleanup(): void {

    this.isDragging = false;
    this.isRotatingCamera = false;
    this.isPanningCamera = false;
    this.activeTouches.clear();
    this.isTouchDragging = false;
    this.isTouchRotating = false;

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

    this.processedPackagesSignal().forEach(pkg => {
      if (pkg.forcePlaceBorder) {
        pkg.forcePlaceBorder.geometry.dispose();
        (pkg.forcePlaceBorder.material as THREE.Material).dispose();
      }
      if (pkg.mesh) {
        pkg.mesh.geometry.dispose();
        (pkg.mesh.material as THREE.Material).dispose();
      }
    });

    this.usedColors.clear();

  }

  /**
   * Component'i tamamen sıfırlar ve başlangıç haline getirir
   * - Three.js scene'i temizler
   * - Tüm package'ları kaldırır
   * - Camera'yı default pozisyona alır
   * - State'leri ve signals'ları sıfırlar
   * - Store'u günceller
   */
  public reset(): void {

    if (this.isDragging) {
      this.cancelDragging();
    }
    if (this.isRotatingCamera) {
      this.stopCameraRotation();
    }
    if (this.isPanningCamera) {
      this.stopCameraPanning();
    }

    if (this.hoverThrottleTimeout) {
      clearTimeout(this.hoverThrottleTimeout);
      this.hoverThrottleTimeout = null;
    }

    this.isLoadingSignal.set(false);
    this.isDataLoadingSignal.set(false);
    this.packagesStateService.clearDeletedPackages();
    this.packagesStateService.clearProcessedPackages();
    this.packagesStateService.clearSelection();

    if (this.packagesGroup) {
      this.processedPackagesSignal().forEach(pkg => {
        if (pkg.mesh) {
          this.packagesGroup.remove(pkg.mesh);
          pkg.mesh = undefined;
        }
      });
      this.packagesGroup.clear();
    }

    this.undoStack = [];
    this.redoStack = [];
    this.canUndo.set(false);
    this.canRedo.set(false);

    this.isLoadingModels = false;
    this.isLoadingData = false;
    this.hasThreeJSError = false;
    this.dragModeEnabled = true;
    this.wireframeMode = false;
    this.currentView = 'isometric';
    this.showControls = true;
    this.showStats = true;
    this.showCollisionWarning = false;

    this.isDragging = false;
    this.draggedPackage = null;
    this.isRotatingCamera = false;
    this.isPanningCamera = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastPanMouseX = 0;
    this.lastPanMouseY = 0;
    this.mouseDownTime = 0;
    this.mouseMoved = false;

    this.activeTouches.clear();
    this.isTouchDragging = false;
    this.isTouchRotating = false;
    this.lastTouchDistance = 0;

    if (this.camera && this.threeContainer) {
      const truckDims = this.truckDimension();

      this.cameraTarget.set(
        truckDims[0] / 2,
        truckDims[2] / 2 + 1100,
        truckDims[1] / 2
      );

      const maxDim = Math.max(...truckDims);
      const distance = maxDim * 1.5;
      this.cameraBaseDistance = distance;
      this.zoomLevel = 10;

      this.camera.position.set(
        this.cameraTarget.x + distance * 0.4,
        this.cameraTarget.y + distance * 0.4,
        this.cameraTarget.z + distance * 0.4
      );
      this.camera.lookAt(this.cameraTarget);
    }

    if (this.dragPlane) {
      this.dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0)
      );
    }

    this.usedColors.clear();

    if (this.renderer?.domElement) {
      this.renderer.domElement.style.cursor = 'grab';
    }

    if (this.renderManager) {
      this.renderManager.requestRender();
    }

    this.cdr.markForCheck();
  }

  // ========================================
  // AUTO PLACEMENT
  // ========================================

  autoPlaceAll(): void {
    const allPackages = [
      ...this.processedPackagesSignal().map(p => ({ ...p, mesh: undefined, forcePlaceBorder: undefined })),
      ...this.deletedPackagesSignal().map(p => ({ ...p, mesh: undefined, forcePlaceBorder: undefined }))
    ];

    if (allPackages.length === 0) return;

    this.saveSnapshot();

    if (this.packagesGroup) {
      this.packagesGroup.clear();
    }

    this.usedColors.clear();
    this.packagesStateService.clearProcessedPackages();
    this.packagesStateService.clearDeletedPackages();
    this.packagesStateService.clearSelection();

    const placed: PackageData[] = [];
    let hasUnplaceable = false;

    for (const pkg of allPackages) {
      pkg.color = this.getUniqueColor();
      pkg.originalColor = pkg.color;
      pkg.isForcePlaced = false;

      const pos = this.findAutoPlacePositionWidthFirst(pkg, placed);

      if (pos) {
        pkg.x = pos.x;
        pkg.y = pos.y;
        pkg.z = pos.z;
      } else {
        const fallback = this.getForcedFallbackPosition(pkg, placed);
        pkg.x = fallback.x;
        pkg.y = fallback.y;
        pkg.z = fallback.z;
        pkg.isForcePlaced = true;
        hasUnplaceable = true;
      }


      this.createPackageMesh(pkg);
      placed.push(pkg);
    }
    allPackages.sort((a, b) => (b.length * b.width) - (a.length * a.width));
    this.packagesStateService.setProcessedPackages(placed);

    if (hasUnplaceable) {
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.AUTO_PLACE_PARTIAL'));
    } else {
      this.toastService.success(this.translate.instant('TRUCK_VISUALIZATION.AUTO_PLACE_SUCCESS'));
    }

    this.orderResultChange();
    this.renderManager.requestRender();
    this.cdr.markForCheck();
  }

  autoPlaceDeleted(): void {
    this.isLocalOperation = true;
    const deleted = [...this.deletedPackagesSignal()];
    if (deleted.length === 0) return;

    this.saveSnapshot();

    let placedCount = 0;
    let failedCount = 0;

    for (const pkg of deleted) {
      pkg.mesh = undefined;
      pkg.forcePlaceBorder = undefined;

      const pos = this.findAutoPlacePosition(pkg);

      if (pos) {
        pkg.x = pos.x;
        pkg.y = pos.y;
        pkg.z = pos.z;
        pkg.isForcePlaced = false;

        if (!pkg.originalColor) {
          pkg.color = this.getUniqueColor();
          pkg.originalColor = pkg.color;
        } else {
          pkg.color = pkg.originalColor;
          this.usedColors.add(pkg.originalColor);
        }

        this.createPackageMesh(pkg);  // önce mesh oluştur, pkg.mesh artık dolu
        this.packagesStateService.removeFromDeletedPackages(pkg.pkgId);
        this.packagesStateService.addToProcessedPackages(pkg);
        this.store.dispatch(StepperResultActions.changeDeletedPackageIsRemaining());
        placedCount++;
      } else {
        failedCount++;
      }
    }

    if (failedCount > 0) {
      this.toastService.warning(
        `${failedCount} ${this.translate.instant('TRUCK_VISUALIZATION.AUTO_PLACE_NO_SPACE')}`
      );
    }

    if (placedCount > 0) {
      this.orderResultChange();
      this.renderManager.requestRender();
      this.cdr.markForCheck();
    }
  }

  private findAutoPlacePosition(
    packageData: PackageData,
    existingPackages?: PackageData[]
  ): { x: number, y: number, z: number } | null {
    const truckDims = this.truckDimension();
    const stepSize = 100;
    const packages = existingPackages ?? this.processedPackagesSignal();

    // 1. Önce aynı L×W ölçüdeki package'ların üstünü dene (stacking)
    const sameDimPackages = packages.filter(p =>
      p.pkgId !== packageData.pkgId &&
      (
        (p.length === packageData.length && p.width === packageData.width) ||
        (p.length === packageData.width && p.width === packageData.length)
      )
    );

    for (const base of sameDimPackages) {
      // Zincir: en üstteki package'ı bul (aynı x,y'de en yüksek z)
      let topZ = base.z + base.height;
      for (const other of packages) {
        if (
          other.pkgId !== packageData.pkgId &&
          other.x === base.x &&
          other.y === base.y
        ) {
          topZ = Math.max(topZ, other.z + other.height);
        }
      }

      if (topZ + packageData.height > truckDims[2]) continue;

      const pos = { x: base.x, y: base.y, z: topZ };
      if (!this.checkCollisionPrecise(packageData, pos, packages)) {
        // Eğer base rotated ise bu paketi de aynı yöne döndür
        if (base.length === packageData.width && base.width === packageData.length) {
          packageData.length = base.length;
          packageData.width = base.width;
          packageData.rotation = (packageData.rotation || 0) + 90;
          packageData.dimensions = `${packageData.length}×${packageData.width}×${packageData.height} mm`;
        }
        return pos;
      }
    }

    // 2. Zemin seviyesinde tara
    for (let x = 0; x <= truckDims[0] - packageData.length; x += stepSize) {
      for (let y = 0; y <= truckDims[1] - packageData.width; y += stepSize) {
        const pos = { x, y, z: 0 };
        if (!this.checkCollisionPrecise(packageData, pos, packages)) {
          return pos;
        }
      }
    }

    // 90 derece döndürülmüş yön
    const rotLength = packageData.width;
    const rotWidth = packageData.length;
    for (let x = 0; x <= truckDims[0] - rotLength; x += stepSize) {
      for (let y = 0; y <= truckDims[1] - rotWidth; y += stepSize) {
        const pos = { x, y, z: 0 };
        const rotatedPkg = { ...packageData, length: rotLength, width: rotWidth };
        if (!this.checkCollisionPrecise(rotatedPkg, pos, packages)) {
          // Paketi döndür
          packageData.length = rotLength;
          packageData.width = rotWidth;
          packageData.rotation = (packageData.rotation || 0) + 90;
          packageData.dimensions = `${packageData.length}×${packageData.width}×${packageData.height} mm`;
          return pos;
        }
      }
    }

    return null;
  }

  private findAutoPlacePositionWidthFirst(
    packageData: PackageData,
    existingPackages: PackageData[]
  ): { x: number, y: number, z: number } | null {
    const truckDims = this.truckDimension();
    const stepSize = 100;

    // 1. Stacking: aynı L×W (veya rotated) üstüne koy
    const sameDimPackages = existingPackages.filter(p =>
      p.pkgId !== packageData.pkgId &&
      (
        (p.length === packageData.length && p.width === packageData.width) ||
        (p.length === packageData.width && p.width === packageData.length)
      )
    );

    for (const base of sameDimPackages) {
      let topZ = base.z + base.height;
      for (const other of existingPackages) {
        if (other.pkgId !== packageData.pkgId &&
          other.x === base.x && other.y === base.y) {
          topZ = Math.max(topZ, other.z + other.height);
        }
      }
      if (topZ + packageData.height > truckDims[2]) continue;

      const pos = { x: base.x, y: base.y, z: topZ };
      if (!this.checkCollisionPrecise(packageData, pos, existingPackages)) {
        if (base.length === packageData.width && base.width === packageData.length) {
          packageData.length = base.length;
          packageData.width = base.width;
          packageData.rotation = (packageData.rotation || 0) + 90;
          packageData.dimensions = `${packageData.length}×${packageData.width}×${packageData.height} mm`;
        }
        return pos;
      }
    }

    // 2. Hangi rotasyon truck genişliğini daha iyi doldurur?
    // Truck width = truckDims[1]
    // width değeri truckDims[1]'e daha yakın olan rotasyonu önceliklendir
    const distOriginal = truckDims[0] % packageData.width;
    const distRotated = truckDims[0] % packageData.length;

    // Rotated daha iyi dolduruyorsa önce onu dene
    const orientations = distRotated <= distOriginal
      ? [
        { length: packageData.width, width: packageData.length, rotate: true },
        { length: packageData.length, width: packageData.width, rotate: false }
      ]
      : [
        { length: packageData.length, width: packageData.width, rotate: false },
        { length: packageData.width, width: packageData.length, rotate: true }
      ];

    // 3. Y-first tarama (genişliği önce doldur)
    for (const orient of orientations) {
      if (orient.length > truckDims[0] || orient.width > truckDims[1]) continue;

      for (let x = 0; x <= truckDims[0] - orient.length; x += stepSize) {
        for (let y = 0; y <= truckDims[1] - orient.width; y += stepSize) {
          const pos = { x, y, z: 0 };
          const testPkg = { ...packageData, length: orient.length, width: orient.width };

          if (!this.checkCollisionPrecise(testPkg as PackageData, pos, existingPackages)) {
            if (orient.rotate) {
              packageData.length = orient.length;
              packageData.width = orient.width;
              packageData.rotation = (packageData.rotation || 0) + 90;
              packageData.dimensions = `${packageData.length}×${packageData.width}×${packageData.height} mm`;
            }
            return pos;
          }
        }
      }
    }

    return null;
  }

  private getForcedFallbackPosition(
    pkg: PackageData,
    existingPackages: PackageData[]
  ): { x: number, y: number, z: number } {
    let maxZ = 0;
    for (const other of existingPackages) {
      const xOverlap = 0 < other.x + other.length && pkg.length > other.x;
      const yOverlap = 0 < other.y + other.width && pkg.width > other.y;
      if (xOverlap && yOverlap) {
        maxZ = Math.max(maxZ, other.z + other.height);
      }
    }
    return { x: 0, y: 0, z: maxZ };
  }
}
