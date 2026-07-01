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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import * as THREE from 'three';
import { ThreeJSInitializationService, ThreeJSComponents } from '@app/shared/threejs-truck-visualization/services/threejs-initialization.service';
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
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './public-order-view.component.html',
  styleUrl: './public-order-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicOrderViewComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('threeContainer', { static: true }) threeContainer!: ElementRef;

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
    this.renderManager.cleanup();
    if (this.threeComponents) this.initService.cleanup(this.threeComponents);
    this.packages.forEach(p => {
      p.mesh?.geometry.dispose();
      (p.mesh?.material as THREE.Material)?.dispose();
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

      this.cameraTarget.set(truckDims[0] / 2, truckDims[2] / 2 + 1100, truckDims[1] / 2);
      this.renderManager.startRenderLoop(this.renderer, this.scene, this.camera);
      this.setupEvents();

      this.resizeObserver = new ResizeObserver(() =>
        this.ngZone.runOutsideAngular(() => this.onResize())
      );
      this.resizeObserver.observe(this.threeContainer.nativeElement);

      this.setView('isometric');
      this.isViewReady = true;
      this.renderManager.requestRender();

    } catch {
      this.setError(this.translate.instant('PUBLIC_ORDER_VIEW.ERROR.THREE_JS'));
    }
  }

  private createMesh(pkg: PackageData): void {
    const { group: palletGroup, palletHeight } = this.createPalletMesh(pkg.length, pkg.width);
    const visualHeight = pkg.height - palletHeight;

    const geometry = new THREE.BoxGeometry(pkg.length, visualHeight, pkg.width);
    const material = new THREE.MeshStandardMaterial({
      color: pkg.color, roughness: 0.65, metalness: 0.01,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      pkg.x + pkg.length / 2,
      pkg.z + palletHeight + visualHeight / 2,
      pkg.y + pkg.width / 2
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { packageData: pkg };

    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.20 })
    ));

    palletGroup.position.set(-pkg.length / 2, -pkg.height / 2 - palletHeight / 2, -pkg.width / 2);
    mesh.add(palletGroup);
    mesh.add(this.createLabel(pkg));

    pkg.mesh = mesh;
    this.packagesGroup.add(mesh);
  }

  private createPalletMesh(pkgLength: number, pkgWidth: number): { group: THREE.Group, palletHeight: number } {
    const group = new THREE.Group();
    const BOARD_THICK = Math.max(18, pkgWidth * 0.018);
    const BLOCK_H = Math.max(70, pkgLength * 0.045);
    const PALLET_H = BOARD_THICK * 2 + BLOCK_H;
    const BOARD_GAP = pkgWidth * 0.03;
    const BOARD_COUNT = 7;
    const BLOCK_W = Math.min(pkgLength * 0.10, 120);

    const matLight = new THREE.MeshStandardMaterial({ color: 0xC4A265, roughness: 0.92, metalness: 0 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0xA07840, roughness: 0.95, metalness: 0 });

    const add = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    };

    const boardDepth = (pkgWidth - BOARD_GAP * (BOARD_COUNT - 1)) / BOARD_COUNT;
    const topY = PALLET_H - BOARD_THICK / 2;

    for (let i = 0; i < BOARD_COUNT; i++) {
      add(pkgLength, BOARD_THICK, boardDepth, pkgLength / 2, topY,
        boardDepth / 2 + i * (boardDepth + BOARD_GAP), i % 2 === 0 ? matLight : matDark);
    }

    const bx = [pkgLength * 0.12, pkgLength * 0.50, pkgLength * 0.88];
    const bz = [pkgWidth * 0.12, pkgWidth * 0.50, pkgWidth * 0.88];

    for (const x of bx) for (const z of bz)
      add(BLOCK_W, BLOCK_H, BLOCK_W, x, BOARD_THICK + BLOCK_H / 2, z, matDark);

    for (const rz of bz)
      add(pkgLength, BOARD_THICK, BLOCK_W * 1.1, pkgLength / 2, BOARD_THICK / 2, rz, matLight);

    return { group, palletHeight: PALLET_H };
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
    return sprite;
  }

  // ─── Kamera ────────────────────────────────────────────────────────────────

  setView(viewType: string): void {
    if (!this.camera) return;
    this.currentView = viewType;
    const d = this.orderData?.truck_dimensions ?? [7000, 2400, 2600];
    this.cameraTarget.set(d[0] / 2, d[2] / 2 + 1100, d[1] / 2);
    const dist = Math.max(...d) * 1.5;
    this.cameraBaseDistance = dist;

    switch (viewType) {
      case 'front': this.camera.position.set(dist, this.cameraTarget.y, this.cameraTarget.z); break;
      case 'side': this.camera.position.set(this.cameraTarget.x, this.cameraTarget.y, dist); break;
      case 'top': this.camera.position.set(this.cameraTarget.x, dist, this.cameraTarget.z); break;
      default:
        this.camera.position.set(
          this.cameraTarget.x + dist * 0.4,
          this.cameraTarget.y + dist * 0.4,
          this.cameraTarget.z + dist * 0.4
        );
    }
    this.camera.lookAt(this.cameraTarget);
    this.renderManager.requestRender();
  }

  applyZoom(value: number): void {
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
    if (e.button === 1 || e.button === 2) {
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
      const sens = dist * 0.001;
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

    // Hover highlight
    const hovered = this.hitTest();
    this.packages.forEach(p => {
      if (p.mesh)
        (p.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(
          p === hovered ? 0x333333 : 0x000000
        );
    });
    this.renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    this.renderManager.requestRender();
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
    this.packages.forEach(p => {
      if (p.mesh)
        (p.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    });
    if (pkg.mesh)
      (pkg.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x666666);
    this.selectedPackage.set(pkg);
    this.renderManager.requestRender();
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  clearSelection(): void {
    this.packages.forEach(p => {
      if (p.mesh)
        (p.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    });
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
