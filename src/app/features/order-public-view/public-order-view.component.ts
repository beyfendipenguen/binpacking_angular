import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  HostListener,
  inject,
  AfterViewInit,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import * as THREE from 'three';
import {
  DECK_TOP_Y, FOV_SENSITIVITY_SCALE, ThreeJSInitializationService, ThreeJSComponents, VIEW_DISTANCE_FACTOR,
} from '@app/shared/threejs-truck-visualization/services/threejs-initialization.service';
import { getQualityProfile } from '@app/shared/threejs-truck-visualization/services/threejs-quality';
import {
  CameraTransition, LoadAnimation, PackageHighlighter,
  boxEdges, buildLoadGeometry, buildPalletGeometries, createLoadMaterial, packageMeshPosition,
} from '@app/shared/threejs-truck-visualization/services/threejs-visuals';
import { ThreeJSRenderManagerService } from '@app/shared/threejs-truck-visualization/services/threejs-render-manager.service';
import { PublicOrderViewData, PackagePosition } from '../interfaces/order.interface';
import { OrderResultService } from '../services/order-result.service';

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface PackageData {
  id: number;
  pkgId: string;
  x: number; y: number; z: number;
  length: number; width: number; height: number;
  weight: number;
  color: string;
  dimensions: string;
  mesh?: THREE.Mesh;
}

interface ShipmentData {
  shipment: number;
  result: PackagePosition[];
}

const COLOR_PALETTE = [
  '#D32F2F', '#1976D2', '#388E3C', '#F57C00', '#7B1FA2',
  '#0097A7', '#FBC02D', '#C2185B', '#00796B', '#455A64',
  '#E64A19', '#1565C0', '#2E7D32', '#AD1457', '#6A1B9A',
  '#00838F', '#F9A825', '#4E342E', '#37474F', '#558B2F',
];

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-public-order-view',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './public-order-view.component.html',
  styleUrl: './public-order-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicOrderViewComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('threeContainer', { static: true }) threeContainer!: ElementRef;
  @ViewChild('hoverTip', { static: true }) private hoverTipRef!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly orderResultService = inject(OrderResultService);
  private readonly renderManager = inject(ThreeJSRenderManagerService);
  private readonly initService = inject(ThreeJSInitializationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly translate = inject(TranslateService);

  isLoading = signal(true);
  hasError = signal(false);
  errorMessage = signal('');
  selectedPackage = signal<PackageData | null>(null);
  isFullscreen = false;
  currentView = 'isometric';
  zoomLevel = 10;
  readonly minZoom = 50;
  readonly maxZoom = 300;

  orderData?: PublicOrderViewData;

  private packages: PackageData[] = [];
  private usedColors = new Set<string>();
  private threeComponents?: ThreeJSComponents;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private packagesGroup!: THREE.Group;
  private isViewReady = false;
  private isDestroyed = false;
  private cameraTarget = new THREE.Vector3();
  private cameraBaseDistance = 0;
  private readonly minCameraPhi = Math.PI / 6;
  private readonly maxCameraPhi = Math.PI / 2.2;
  private readonly minCameraHeight = 500;
  private isRotatingCamera = false;
  private isPanningCamera = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastPanMouseX = 0;
  private lastPanMouseY = 0;
  private mouseDownTime = 0;
  private mouseMoved = false;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private activeTouches = new Map<number, Touch>();
  private lastTouchDistance = 0;
  private resizeObserver?: ResizeObserver;
  private destroy$ = new Subject<void>();

  // Görsel katman — düzenleme ekranıyla ORTAK yapı taşları (services/threejs-visuals.ts)
  private readonly quality = getQualityProfile();
  private readonly highlighter = new PackageHighlighter();
  private readonly camTransition = new CameraTransition();
  private readonly loadAnimation = new LoadAnimation();
  private readonly reducedMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private hoveredPackage: PackageData | null = null;
  private palletGeometryCache = new Map<string, {
    light: THREE.BufferGeometry; dark: THREE.BufferGeometry; height: number;
  }>();
  private palletMaterials: { light: THREE.Material; dark: THREE.Material } | null = null;
  private readonly onVisibilityChange = () => this.renderManager.setPaused(document.hidden);

  shipments: ShipmentData[] = [];
  activeShipmentIndex = signal(0);

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';
    document.addEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
  }

  async ngAfterViewInit(): Promise<void> {
    const guid = this.route.snapshot.paramMap.get('guid');
    if (!guid) {
      this.setError(this.translate.instant('PUBLIC_ORDER_VIEW.ERROR.INVALID_LINK'));
      return;
    }
    this.fetchData(guid);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    document.removeEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
    this.resizeObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.isDestroyed = true;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderManager.setPaused(false);
    this.renderManager.cleanup();
    this.camTransition.cancel();
    this.loadAnimation.cancel();
    if (this.packagesGroup) this.disposeTree(this.packagesGroup);
    if (this.threeComponents) this.initService.cleanup(this.threeComponents);
    this.highlighter.dispose();
    this.palletGeometryCache.forEach(e => { e.light.dispose(); e.dark.dispose(); });
    this.palletGeometryCache.clear();
    this.palletMaterials?.light.dispose();
    this.palletMaterials?.dark.dispose();
    this.palletMaterials = null;
  }

  /** Alt ağacın geometri/materyal/texture kaynaklarını serbest bırakır (paylaşılanlar hariç). */
  private disposeTree(root: THREE.Object3D): void {
    root.traverse(obj => {
      const o = obj as THREE.Mesh;
      if (o.geometry && !o.geometry.userData?.['shared']) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(m => {
        if (m.userData?.['shared']) return;
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      });
    });
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  private fetchData(guid: string): void {
    this.orderResultService.getPublicOrderView(guid)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (data) => {
          this.orderData = data;
          await this.initThreeJS(data.truck_dimensions);

          // Yeni format: {"shipments": [...]}
          const raw = data.order_result as any;
          if (raw?.shipments) {
            this.shipments = raw.shipments;
          } else {
            // Eski format fallback
            this.shipments = [{ shipment: 1, result: data.order_result as any }];
          }

          this.buildPackages(this.shipments[0]?.result ?? []);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          const key = err.status === 404
            ? 'PUBLIC_ORDER_VIEW.ERROR.NOT_FOUND'
            : 'PUBLIC_ORDER_VIEW.ERROR.GENERIC';
          this.setError(this.translate.instant(key));
        }
      });
  }

  goToShipment(index: number): void {
    this.activeShipmentIndex.set(index);
    this.buildPackages(this.shipments[index]?.result ?? []);
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  get isMultiShipment(): boolean {
    return this.shipments.length > 1;
  }

  get totalWeightDisplay(): string {
  const currentResult = this.shipments[this.activeShipmentIndex()]?.result ?? [];
  const w = currentResult
    .filter(r => r[0] !== -1)
    .reduce((sum, r) => sum + (r[7] || 0), 0);
  return w >= 1000 ? `${(w / 1000).toFixed(1)} Ton` : `${w.toFixed(0)} kg`;
}


  private buildPackages(positions: PackagePosition[]): void {
    if (!this.packagesGroup) return;
    this.loadAnimation.cancel();
    this.hoveredPackage = null;
    this.selectedPackage.set(null);
    this.updateHoverTip(null);
    this.disposeTree(this.packagesGroup);
    this.packagesGroup.clear();
    this.packages = [];
    this.usedColors.clear();

    positions
      .filter(p => p[0] !== -1)
      .forEach(p => {
        const pkg: PackageData = {
          id: p[6], pkgId: p[8],
          x: p[0], y: p[1], z: p[2],
          length: p[3], width: p[4], height: p[5],
          weight: p[7],
          color: this.nextColor(),
          dimensions: `${p[3]}×${p[4]}×${p[5]} mm`,
        };
        this.createMesh(pkg);
        this.packages.push(pkg);
      });

    this.playLoadAnimation();
    this.renderManager.requestRender();
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  // ─── Three.js ──────────────────────────────────────────────────────────────

  private async initThreeJS(truckDims: [number, number, number]): Promise<void> {
    try {
      this.threeComponents = await this.initService.initialize({
        containerElement: this.threeContainer.nativeElement,
        truckDimensions: truckDims,
        enableShadows: true,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
      });

      this.scene = this.threeComponents.scene;
      this.camera = this.threeComponents.camera;
      this.renderer = this.threeComponents.renderer;
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.packagesGroup = this.threeComponents.packagesGroup;

      this.cameraTarget.set(truckDims[0] / 2, truckDims[2] / 2 + DECK_TOP_Y, truckDims[1] / 2);
      this.renderManager.startRenderLoop(this.renderer, this.scene, this.camera, () => this.onFrame());
      this.setupEvents();
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      this.resizeObserver = new ResizeObserver(() =>
        this.ngZone.runOutsideAngular(() => this.onResize())
      );
      this.resizeObserver.observe(this.threeContainer.nativeElement);

      this.setView('isometric', false);
      this.isViewReady = true;
      this.renderManager.requestRender();

    } catch {
      this.setError(this.translate.instant('PUBLIC_ORDER_VIEW.ERROR.THREE_JS'));
    }
  }

  /** Her karede (render döngüsü): kamera geçişi + yükleme animasyonu. */
  private onFrame(): void {
    const now = performance.now();
    let dirty = this.camTransition.tick(now, this.camera, this.cameraTarget);
    dirty = this.loadAnimation.tick(now, this.resolveLoadTarget) || dirty;
    if (dirty) this.renderManager.requestRender();
  }

  private readonly resolveLoadTarget = (id: string, out: THREE.Vector3): THREE.Object3D | null => {
    const pkg = this.packages.find(p => p.pkgId === id);
    if (!pkg?.mesh) return null;
    packageMeshPosition(pkg, out);
    return pkg.mesh;
  };

  /** Paletler arka kapıdan sırayla içeri kayar (açılışta ve sevkiyat değişince). */
  private playLoadAnimation(): void {
    if (this.reducedMotion || this.packages.length === 0) return;
    const d = this.orderData?.truck_dimensions ?? [7000, 2400, 2600];
    const ids = [...this.packages]
      .sort((p, q) => (p.x - q.x) || (p.z - q.z) || (p.y - q.y))
      .map(p => p.pkgId);
    this.loadAnimation.start(ids, d[0] + 3500);
    this.loadAnimation.tick(performance.now(), this.resolveLoadTarget);
  }

  private finishLoadAnimation(): void {
    if (!this.loadAnimation.active) return;
    this.loadAnimation.finish(this.resolveLoadTarget);
    this.renderManager.requestRender();
  }

  /** Palet + katmanlı yük — düzenleme ekranıyla aynı görünüm (bkz. threejs-visuals.ts). */
  private createMesh(pkg: PackageData): void {
    const { group: palletGroup, palletHeight } = this.createPalletMesh(pkg.length, pkg.width);
    const visualHeight = pkg.height - palletHeight;
    const shadows = this.quality.shadows;

    const mesh = new THREE.Mesh(
      buildLoadGeometry(pkg.length, visualHeight, pkg.width, pkg.color),
      createLoadMaterial(this.quality.cheapMaterials)
    );
    packageMeshPosition(pkg, mesh.position);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.userData = { packageData: pkg };

    const outline = new THREE.LineSegments(
      boxEdges(pkg.length, visualHeight, pkg.width),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 })
    );
    outline.raycast = () => { /* seçimi etkilemesin */ };
    mesh.add(outline);

    palletGroup.position.set(-pkg.length / 2, -pkg.height / 2 - palletHeight / 2, -pkg.width / 2);
    mesh.add(palletGroup);
    mesh.add(this.createLabel(pkg));

    pkg.mesh = mesh;
    this.packagesGroup.add(mesh);
  }

  /** Ahşap palet: boyuta göre önbelleklenen 2 birleşik geometri, paylaşılan materyaller. */
  private createPalletMesh(pkgLength: number, pkgWidth: number): { group: THREE.Group, palletHeight: number } {
    const key = `${Math.round(pkgLength)}x${Math.round(pkgWidth)}`;
    let entry = this.palletGeometryCache.get(key);
    if (!entry) {
      entry = buildPalletGeometries(pkgLength, pkgWidth);
      this.palletGeometryCache.set(key, entry);
    }
    if (!this.palletMaterials) {
      const make = (color: number, roughness: number): THREE.Material => {
        const m = this.quality.cheapMaterials
          ? new THREE.MeshLambertMaterial({ color })
          : new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
        m.userData['shared'] = true;
        return m;
      };
      this.palletMaterials = { light: make(0xC4A265, 0.92), dark: make(0xA07840, 0.95) };
    }

    const group = new THREE.Group();
    [
      new THREE.Mesh(entry.light, this.palletMaterials.light),
      new THREE.Mesh(entry.dark, this.palletMaterials.dark),
    ].forEach(m => {
      m.castShadow = this.quality.shadows;
      m.receiveShadow = this.quality.shadows;
      m.raycast = () => { /* tıklama yük gövdesinden algılanır */ };
      group.add(m);
    });
    return { group, palletHeight: entry.height };
  }

  private createLabel(pkg: PackageData): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(40, 40, 432, 176);
    ctx.font = 'bold 140px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(`#${pkg.id}`, 256, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`#${pkg.id}`, 256, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
    );
    sprite.renderOrder = 999;
    sprite.scale.set(600, 300, 1);
    sprite.position.set(0, pkg.height / 2 + 100, 0);
    sprite.raycast = () => { /* etiket tıklamayı kesmesin */ };
    return sprite;
  }

  // ─── Kamera ────────────────────────────────────────────────────────────────

  setView(viewType: string, animate = true): void {
    if (!this.camera) return;
    this.currentView = viewType;
    const d = this.orderData?.truck_dimensions ?? [7000, 2400, 2600];
    const target = new THREE.Vector3(d[0] / 2, d[2] / 2 + DECK_TOP_Y, d[1] / 2);
    const dist = Math.max(...d) * VIEW_DISTANCE_FACTOR;
    this.cameraBaseDistance = dist;

    const position = new THREE.Vector3();
    switch (viewType) {
      case 'front': position.set(dist, target.y, target.z); break;
      case 'side': position.set(target.x, target.y, dist); break;
      // Tam tepe (phi = 0) lookAt için tekil — çok az eğim
      case 'top': position.set(target.x, dist, target.z + dist * 0.0005); break;
      default:
        position.set(target.x + dist * 0.4, target.y + dist * 0.4, target.z + dist * 0.4);
    }

    // Üstten bakışta gölge zemini gizlenir
    const ground = this.threeComponents?.groundMesh;
    if (ground) ground.visible = viewType !== 'top';

    if (animate && !this.reducedMotion && this.isViewReady) {
      this.camTransition.start(this.camera, this.cameraTarget, position, target);
    } else {
      this.camTransition.cancel();
      this.cameraTarget.copy(target);
      this.camera.position.copy(position);
      this.camera.lookAt(this.cameraTarget);
    }
    this.renderManager.requestRender();
  }

  applyZoom(value: number): void {
    this.camTransition.cancel();
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(value)));
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.cameraTarget).normalize();
    if (!this.cameraBaseDistance)
      this.cameraBaseDistance = this.camera.position.distanceTo(this.cameraTarget);
    const pos = new THREE.Vector3().addVectors(
      this.cameraTarget, dir.multiplyScalar(this.cameraBaseDistance * (100 / this.zoomLevel))
    );
    if (pos.y < this.minCameraHeight) pos.y = this.minCameraHeight;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.cameraTarget);
    this.renderManager.requestRender();
  }

  private rotateAround(deltaX: number, deltaY: number): void {
    const sph = new THREE.Spherical().setFromVector3(
      this.camera.position.clone().sub(this.cameraTarget)
    );
    sph.theta -= deltaX;
    sph.phi = Math.max(this.minCameraPhi, Math.min(this.maxCameraPhi, sph.phi - deltaY));
    const pos = new THREE.Vector3().setFromSpherical(sph).add(this.cameraTarget);
    if (pos.y < this.minCameraHeight) pos.y = this.minCameraHeight;
    this.camera.position.copy(pos);
    this.camera.lookAt(this.cameraTarget);
  }

  // ─── Mouse / Touch Events ──────────────────────────────────────────────────

  private setupEvents(): void {
    const c = this.renderer.domElement;
    c.addEventListener('mousedown', this.onMouseDown.bind(this), { passive: false });
    c.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: false });
    c.addEventListener('mouseup', this.onMouseUp.bind(this), { passive: false });
    c.addEventListener('click', this.onClick.bind(this), { passive: false });
    c.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });
    c.addEventListener('mouseleave', () => this.setHovered(null));
    c.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    c.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    c.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  private updateMouse(e: MouseEvent): void {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      ((e.clientY - r.top) / r.height) * -2 + 1
    );
  }

  private hitTest(): PackageData | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.packagesGroup.children);
    return hits.length > 0
      ? (hits[0].object as THREE.Mesh).userData['packageData'] ?? null
      : null;
  }

  private onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.mouseDownTime = Date.now();
    this.mouseMoved = false;
    this.updateMouse(e);
    this.updateHoverTip(null);
    this.finishLoadAnimation();
    if (e.button === 1 || e.button === 2) {
      this.camTransition.cancel();
      this.isRotatingCamera = e.button === 2 && !e.ctrlKey;
      this.isPanningCamera = e.button === 1 || (e.button === 2 && e.ctrlKey);
      this.lastMouseX = this.lastPanMouseX = e.clientX;
      this.lastMouseY = this.lastPanMouseY = e.clientY;
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  }

  private onMouseMove(e: MouseEvent): void {
    this.mouseMoved = true;
    this.updateMouse(e);

    if (this.isRotatingCamera) {
      this.rotateAround(
        (e.clientX - this.lastMouseX) * 0.005,
        (e.clientY - this.lastMouseY) * 0.005
      );
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.renderManager.requestRender();
      return;
    }

    if (this.isPanningCamera) {
      this.camera.updateMatrixWorld();
      const dist = this.camera.position.distanceTo(this.cameraTarget);
      const sens = dist * 0.001 * FOV_SENSITIVITY_SCALE;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      const offset = right.multiplyScalar(-(e.clientX - this.lastPanMouseX) * sens)
        .add(up.multiplyScalar((e.clientY - this.lastPanMouseY) * sens));
      this.camera.position.add(offset);
      this.cameraTarget.add(offset);
      this.lastPanMouseX = e.clientX;
      this.lastPanMouseY = e.clientY;
      this.renderManager.requestRender();
      return;
    }

    // Hover: teal çerçeve + ipucu
    const hovered = this.loadAnimation.active ? null : this.hitTest();
    this.setHovered(hovered);
    this.renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
  }

  private setHovered(pkg: PackageData | null): void {
    this.updateHoverTip(pkg);
    if (pkg === this.hoveredPackage) return;
    this.highlighter.detach(this.hoveredPackage?.mesh, 'hover');
    this.hoveredPackage = pkg;
    if (pkg?.mesh && pkg !== this.selectedPackage()) {
      this.highlighter.attach(pkg.mesh, pkg, 'hover');
    }
    this.renderManager.requestRender();
  }

  /** İmleç yanında kısa bilgi: "Palet N · L × W mm · Yük yüksekliği H mm". */
  private updateHoverTip(pkg: PackageData | null): void {
    const el = this.hoverTipRef?.nativeElement;
    if (!el) return;
    if (!pkg || this.isRotatingCamera || this.isPanningCamera) {
      el.style.display = 'none';
      return;
    }
    el.textContent =
      `${this.translate.instant('TRUCK_VISUALIZATION.TIP_PALLET')} ${pkg.id} · ` +
      `${Math.round(pkg.length)} × ${Math.round(pkg.width)} mm · ` +
      `${this.translate.instant('TRUCK_VISUALIZATION.TIP_LOAD_HEIGHT')} ${Math.round(pkg.height)} mm`;
    const canvas = this.renderer.domElement;
    const x = (this.mouse.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-this.mouse.y * 0.5 + 0.5) * canvas.clientHeight;
    el.style.display = 'block';
    el.style.transform = `translate(${Math.round(x + 14)}px, ${Math.round(y + 16)}px)`;
  }

  private onMouseUp(e: MouseEvent): void {
    this.isRotatingCamera = false;
    this.isPanningCamera = false;
    this.renderer.domElement.style.cursor = 'grab';
  }

  private onClick(e: MouseEvent): void {
    if (this.mouseMoved || Date.now() - this.mouseDownTime > 200) return;
    this.updateMouse(e);
    const hit = this.hitTest();
    hit ? this.selectPackage(hit) : this.clearSelection();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.applyZoom(this.zoomLevel + (e.deltaY > 0 ? -1 : 1));
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.camTransition.cancel();
    this.finishLoadAnimation();
    for (let i = 0; i < e.changedTouches.length; i++)
      this.activeTouches.set(e.changedTouches[i].identifier, e.changedTouches[i]);
    if (e.touches.length === 2) {
      this.lastTouchDistance = this.touchDist(e.touches[0], e.touches[1]);
    }
    this.lastMouseX = e.touches[0]?.clientX ?? 0;
    this.lastMouseY = e.touches[0]?.clientY ?? 0;
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++)
      this.activeTouches.set(e.changedTouches[i].identifier, e.changedTouches[i]);

    if (e.touches.length === 1) {
      this.rotateAround(
        (e.touches[0].clientX - this.lastMouseX) * 0.005,
        (e.touches[0].clientY - this.lastMouseY) * 0.005
      );
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.renderManager.requestRender();
    } else if (e.touches.length === 2) {
      const dist = this.touchDist(e.touches[0], e.touches[1]);
      if (this.lastTouchDistance > 0)
        this.applyZoom(this.zoomLevel + (1 - dist / this.lastTouchDistance) * 5);
      this.lastTouchDistance = dist;
      this.renderManager.requestRender();
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++)
      this.activeTouches.delete(e.changedTouches[i].identifier);
    if (e.touches.length === 0) {
      this.lastTouchDistance = 0;
      this.activeTouches.clear();
    }
  }

  private touchDist(t1: Touch, t2: Touch): number {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  // ─── Seçim ─────────────────────────────────────────────────────────────────

  private selectPackage(pkg: PackageData): void {
    const previous = this.selectedPackage();
    this.highlighter.detach(previous?.mesh, 'selected');
    if (pkg.mesh) {
      this.highlighter.detach(pkg.mesh, 'hover');
      this.highlighter.attach(pkg.mesh, pkg, 'selected');
    }
    this.selectedPackage.set(pkg);
    this.renderManager.requestRender();
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  clearSelection(): void {
    this.highlighter.detach(this.selectedPackage()?.mesh, 'selected');
    this.selectedPackage.set(null);
    this.renderManager.requestRender();
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  // ─── Fullscreen ────────────────────────────────────────────────────────────

  toggleFullscreen(): void {
    const layoutEl = document.querySelector('.layout-container') as HTMLElement;

    if (!this.isFullscreen) {
      if (layoutEl) layoutEl.style.visibility = 'hidden';
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  private onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;

    const layoutEl = document.querySelector('.layout-container') as HTMLElement;
    if (layoutEl) {
      layoutEl.style.visibility = this.isFullscreen ? 'hidden' : '';
    }

    setTimeout(() => this.onResize(), 100);
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  // ─── Klavye ────────────────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape': this.clearSelection(); break;
      case 'f': case 'F': this.toggleFullscreen(); break;
      case '1': this.setView('isometric'); break;
      case '2': this.setView('front'); break;
      case '3': this.setView('side'); break;
      case '4': this.setView('top'); break;
    }
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  @HostListener('window:resize')
  onResize(): void {
    if (!this.renderer || !this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false); // false = inline style yazma
      this.renderManager.requestRender();
    }
  }

  // ─── Yardımcılar ───────────────────────────────────────────────────────────

  private nextColor(): string {
    for (const c of COLOR_PALETTE) {
      if (!this.usedColors.has(c)) { this.usedColors.add(c); return c; }
    }
    const r = `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
    this.usedColors.add(r);
    return r;
  }

  private setError(msg: string): void {
    this.hasError.set(true);
    this.errorMessage.set(msg);
    this.isLoading.set(false);
    this.cdr.markForCheck();
  }

  get totalWeightDisplay1(): string {
    const w = this.orderData?.total_weight ?? 0;
    return w >= 1000 ? `${(w / 1000).toFixed(1)} t` : `${w.toFixed(0)} kg`;
  }

  get formattedDate(): string {
    if (!this.orderData?.created_at) return '';
    const lang = this.translate.currentLang ?? 'tr';
    return new Date(this.orderData.created_at).toLocaleDateString(
      lang === 'tr' ? 'tr-TR' : lang === 'ru' ? 'ru-RU' : 'en-GB',
      { day: '2-digit', month: 'long', year: 'numeric' }
    );
  }
}
