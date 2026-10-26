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
  signal,
  computed,
  effect,
  untracked,
  Input
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { Store } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import { AppState, PackageGroupsActions, selectMultiSelectedIds, selectPackageGroups, selectActiveShipmentIndex, selectDeletedPackages, selectFirstZoneDepthMm, selectIsMultiShipment, selectOrderResult, selectPackages, selectRearClearance, selectShipments, selectStep3IsDirty, selectTruck, selectUserPermissions, selectZoneWeightLimits, StepperResultActions } from '../../store';
import { StepperUiActions } from '@app/store/stepper/actions/stepper-ui.actions';
import { StepperPackageActions } from '@app/store/stepper/actions/stepper-package.actions';
import { ThreeJSRenderManagerService } from './services/threejs-render-manager.service';
import { ThreeJSComponents, ThreeJSInitializationService } from './services/threejs-initialization.service';
import { getQualityProfile } from './services/threejs-quality';
import { PackagesStateService } from './services/packages-state.service';
import { PackageData, PackagePosition, PackageSnapshot } from '@app/features/interfaces/order-result.interface';
import { toObservable } from '@angular/core/rxjs-interop';
import { skip, distinctUntilChanged, takeUntil, take, Subject } from 'rxjs';
import { ToastService } from '@app/core/services/toast.service';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../generic-table/confirm-dialog/confirm-dialog.component';



/** Toplu (çoklu seçim / grup) sürükleme durumu. */
interface GroupDragState {
  members: PackageData[];
  fromPlate: boolean;
  /** Dünya (data) koordinatı (plate üyeleri için plate ofseti eklenmiş) + seviye z. */
  start: Map<string, { x: number; y: number; lz: number }>;
  startMesh: Map<string, THREE.Vector3>;
  startPointer: THREE.Vector3;
  bbox: { minX: number; maxX: number; minY: number; maxY: number };
  moved: boolean;
  dx: number;
  dy: number;
  overPlate: boolean;
  valid: boolean;
}

@Component({
  selector: 'app-threejs-truck-visualization',
  standalone: true,
  imports: [FormsModule, TranslateModule, DisableAuthDirective, MatIconModule, MatTooltipModule],
  templateUrl: './threejs-truck-visualization.component.html',
  styleUrl: './threejs-truck-visualization.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThreeJSTruckVisualizationComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('threeContainer', { static: true }) threeContainer!: ElementRef;
  // Seçili paketin üstünde onu takip eden hızlı-aksiyon halkası (bkz.
  // updateActionRingPosition). @if bloğuna bağlı olduğu için seçim yokken
  // DOM'dan kalkar — ViewChild static:false, referans her değiştiğinde
  // Angular tarafından güncellenir.
  @ViewChild('actionRing') actionRingRef?: ElementRef<HTMLElement>;
  // Plate'te seçili paket için ayrı, daha sade bir aksiyon halkası (sadece
  // döndür + pasif sil — bkz. task: "Plate paket aksiyonları"). Tır seçimi
  // (selectedPackageSignal, packagesStateService üzerinden) ile bilerek
  // AYRI tutulur — mevcut tır akışlarına dokunmadan eklemek için.
  @ViewChild('plateActionRing') plateActionRingRef?: ElementRef<HTMLElement>;
  selectedPlatePackageSignal = signal<PackageData | null>(null);
  @Input() isActive = false;
  
  // Sol tarafta gösterilen "klavye kısayolları" panelinin açık/kapalı durumu.
  // Tercih localStorage'da saklanır, sayfa yenilense/tekrar açılsa bile
  // kullanıcının seçimi korunur. Varsayılan olarak (ilk açılışta) görünür.
  private readonly SHOW_SHORTCUTS_HINT_STORAGE_KEY = 'tjs-show-shortcuts-hint';
  showHelp: boolean = this.loadShowShortcutsHintPreference();
  // Sol altta gösterilen "yerleşmeyen ürünler" (deletedPackages) kartının
  // açık/kapalı durumu — tercih localStorage'da saklanır.
  private readonly SHOW_UNPLACED_CARD_STORAGE_KEY = 'tjs-show-unplaced-card';
  showUnplacedCard: boolean = this.loadShowUnplacedCardPreference();
  isFullscreen = false;
  // Paket üst/yan yüzeylerindeki ürün detay etiketlerini her zaman (hover
  // beklemeden) gösterme aç/kapa durumu — bkz. toggleAllPackageLabels().
  // Tercih localStorage'da saklanır, sayfa yenilense/tekrar açılsa bile
  // kullanıcının seçimi korunur.
  private readonly SHOW_ALL_LABELS_STORAGE_KEY = 'tjs-show-all-package-labels';
  showAllPackageLabels = this.loadShowAllPackageLabelsPreference();

  /** Cihaz gücüne göre otomatik kalite profili (bkz. services/threejs-quality.ts). */
  private readonly quality = getQualityProfile();

  /**
   * Palet geometrileri (boyuta göre) ve palet materyalleri TÜM paketler arasında
   * paylaşılır: eskiden her paket ~19 ayrı Mesh + 19 BoxGeometry üretiyordu.
   * Paylaşılan kaynaklar `userData.shared = true` ile işaretlenir ve
   * disposeObjectTree tarafından atlanır; bileşen yok edilirken topluca serbest bırakılır.
   */
  private palletGeometryCache = new Map<string, {
    light: THREE.BufferGeometry; dark: THREE.BufferGeometry; height: number;
  }>();
  private sharedPalletMaterials: { light: THREE.Material; dark: THREE.Material } | null = null;
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
  private readonly dialog = inject(MatDialog);
  private readonly actions$ = inject(Actions);

  // Signals
  truckDimension = this.store.selectSignal(selectTruck);
  rearClearanceSignal = this.store.selectSignal(selectRearClearance);
  isDirty = this.store.selectSignal(selectStep3IsDirty);
  piecesDataSignal = this.store.selectSignal(selectOrderResult);
  isLoadingSignal = signal(true);
  isDataLoadingSignal = signal(false);
  deletedPackagesSignal = computed(() => {
    const rows = this.store.selectSignal(selectDeletedPackages)();
    return rows.map(row => ({
      id: row[6],
      x: -1, y: -1, z: -1,
      length: row[3],
      width: row[4],
      height: row[5],
      weight: row[7],
      pkgId: row[8],
      dimensions: `${row[3]}×${row[4]}×${row[5]} mm`,
    } as PackageData));
  });
  // "Yerleşmeyen ürünler" kartı: plate'teki (deletedPackages) paketlerin
  // ürünleri, ürün bazında toplanmış adetlerle. packagesStateService.deletedPackages
  // canlı signal olduğu için plate'e paket eklenip çıkarıldıkça anında güncellenir.
  unplacedSummary = computed(() => {
    const deleted = this.packagesStateService.deletedPackages();
    const packages = Object.values(this.packagesSignal() ?? {}) as any[];
    const byId = new Map<string, any>(packages.map(p => [p.id, p]));
    const totals = new Map<string, { name: string; count: number }>();
    for (const pkg of deleted) {
      const details = byId.get(pkg.pkgId)?.package_details ?? [];
      for (const d of details) {
        const key = String(d?.product?.id ?? d?.product?.name ?? '');
        if (!key || !(d.count > 0)) continue;
        const entry = totals.get(key) ?? { name: d.product?.name ?? key, count: 0 };
        entry.count += d.count;
        totals.set(key, entry);
      }
    }
    const items = [...totals.values()].sort((a, b) => b.count - a.count);
    return {
      packageCount: deleted.length,
      totalUnits: items.reduce((s, i) => s + i.count, 0),
      items,
    };
  });
  processedPackagesSignal = this.packagesStateService.processedPackages;
  selectedPackageSignal = this.packagesStateService.selectedPackage;
  packagesSignal = this.store.selectSignal(selectPackages);
  readonly isMultiShipmentSignal = this.store.selectSignal(selectIsMultiShipment);
  readonly shipmentsSignal = this.store.selectSignal(selectShipments);
  readonly activeShipmentIndexSignal = this.store.selectSignal(selectActiveShipmentIndex);
  private piecesData$ = toObservable(this.piecesDataSignal);
  private permissions = this.store.selectSignal(selectUserPermissions);
  private readonly zoneWeightLimits = this.store.selectSignal(selectZoneWeightLimits);
  // Three.js components
  private threeComponents?: ThreeJSComponents;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private packagesGroup!: THREE.Group;
  // Plate (bekleme alanı) — tırın yanında (Z ekseni), yerleşmeyen paketlerin
  // 3D olarak gösterildiği ayrı bir grup. Konum: packagesGroup ile aynı Y
  // offset'i (truck bed yüksekliği), Z'de tır genişliğinin ötesinde başlar
  // (bkz. positionPlateGroup). X/Z için packagesGroup'un aksine offset'i
  // SIFIR DEĞİL — bu yüzden bir paket plate'ten sürüklenirken geçici olarak
  // packagesGroup'a reparent edilir (bkz. initiateDragging).
  private plateGroup!: THREE.Group;
  private plateFloorMesh?: THREE.Mesh;
  private readonly PLATE_GAP = 600; // tır ile plate arası boşluk (mm)
  private readonly PLATE_ITEM_GAP = 150; // plate grid hücreleri arası boşluk (mm)
  private readonly PLATE_MIN_DEPTH = 2200; // plate zemininin asgari derinliği (mm)
  private plateDepthCurrent = 0; // en son hesaplanan plate derinliği — sürükleme sınırı için

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
  // Sürüklenen paket plate'ten mi geldi? (bkz. initiateDragging/completeDragging
  // — tırdan plate'e / plate'ten tıra geçişleri buna göre finalize edilir)
  private draggedFromPlate = false;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private dragPlane = new THREE.Plane();
  private dragOffset = new THREE.Vector3();
  private dragSensitivity = 0.9;
  private lastDragPosition = new THREE.Vector3();
  private dragStartPosition: { x: number; y: number; z: number } | null = null;

  // Action ring (seçili paketin üstünde takip eden hızlı aksiyon halkası)
  // — her frame'de (RAF callback) çağrılır, Angular değişiklik algılamasına
  // hiç girmeden doğrudan DOM style yazar (performans için, bkz.
  // updateActionRingPosition).
  private readonly ringProjectionVector = new THREE.Vector3();
  // Halka ile paketin üstü arasında ekstra ekran-uzayı boşluk (px) —
  // "margin-bottom" isteği: transform JS ile yazıldığı için gerçek CSS
  // margin'i pozisyona etki etmiyor (top:0/left:0 + translate kullanılıyor,
  // margin sadece bottom/right ile konumlananları etkiler), o yüzden bu
  // boşluğu doğrudan piksel hesabına ekliyoruz.
  private readonly RING_VERTICAL_GAP = 14;

  // Çakışma/sınır uyarıları — bir paket başka bir paketin İÇİNDE (zorla
  // yerleştirme çakışma kontrolünü kapattığı için mümkün) ya da tır dışında
  // ise paketin üstünde tooltip tarzı bir rozet gösterilir. Liste
  // refreshOverlapWarnings() ile her konum/yönelim değişiminde (sürükleme
  // dahil, "normale döndür" beklemeden) yenilenir; rozetlerin ekran
  // konumu her frame'de doğrudan DOM'a yazılır (bkz.
  // updateOverlapBadgePositions, action ring ile aynı mantık).
  readonly overlapWarningsSignal = signal<{ pkgId: string; text: string }[]>([]);
  private overlapWarningsKey = '';
  @ViewChild('overlapLayer') overlapLayerRef?: ElementRef<HTMLElement>;

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
  private skipStoreSync = false;

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

  private deletedPackagesSyncEffect = effect(() => {
    const deletedRows = this.store.selectSignal(selectDeletedPackages)();
    if (!this.isViewReady) return;
    untracked(() => {
      this.syncDeletedPackagesCache(deletedRows);
    });
  });

  // Plate (bekleme alanı) görselleştirmesini packagesStateService.deletedPackages
  // her değiştiğinde OTOMATİK yeniden kurar — bu sayede sil/geri-ekle/otomatik
  // yerleştir/undo-redo/sürükle-bırak gibi TÜM mutasyon noktalarına ayrı ayrı
  // "plate'i güncelle" çağrısı eklemek gerekmiyor (hepsi zaten bu signal'ı
  // güncelliyor).
  private plateVisualizationSyncEffect = effect(() => {
    const deleted = this.packagesStateService.deletedPackages();
    void deleted; // sadece dependency tracking için okunuyor
    if (!this.isViewReady) return;
    untracked(() => {
      this.createPlateVisualization();
    });
  });

  // ========================================
  // ÇOKLU SEÇİM + NUMARALI GRUPLAR (NgRx: store/package-groups)
  // ========================================
  readonly multiSelectedSignal = this.store.selectSignal(selectMultiSelectedIds);
  private readonly rawGroupsSignal = this.store.selectSignal(selectPackageGroups);
  /**
   * Gruplar sevkiyat bazında tutulur (store anahtarı `<sevkiyatIndex>:<no>`): her sevkiyatın
   * kendi 1..9 numaraları vardır. Bu signal SADECE aktif sevkiyatın gruplarını (no → pkgId[]) verir.
   */
  readonly groupsSignal = computed(() => {
    const prefix = `${this.activeShipmentIndexSignal()}:`;
    const out: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(this.rawGroupsSignal())) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = ids;
    }
    return out;
  });
  private groupKey(no: string | number): string {
    return `${this.activeShipmentIndexSignal()}:${no}`;
  }
  readonly multiCount = computed(() => this.multiSelectedSignal().length);
  /** Paketlerin üstünde gösterilen grup numarası rozetleri. */
  readonly groupBadges = computed(() => {
    const out: { pkgId: string; no: string }[] = [];
    for (const [no, ids] of Object.entries(this.groupsSignal())) {
      ids.forEach(pkgId => out.push({ pkgId, no }));
    }
    return out;
  });
  /** Çoklu seçim paneli özeti: adet, toplam ağırlık, (tam bir grupsa) grup no. */
  readonly multiInfo = computed(() => {
    const ids = this.multiSelectedSignal();
    if (ids.length < 2) return null;
    const all = [...this.packagesStateService.processedPackages(), ...this.packagesStateService.deletedPackages()];
    const byId = new Map(all.map(p => [p.pkgId, p]));
    const weight = ids.reduce((s, id) => s + (byId.get(id)?.weight ?? 0), 0);
    const set = new Set(ids);
    let groupNo: string | null = null;
    for (const [no, members] of Object.entries(this.groupsSignal())) {
      if (members.length === set.size && members.every(m => set.has(m))) { groupNo = no; break; }
    }
    const anyGrouped = ids.some(id => Object.values(this.groupsSignal()).some(m => m.includes(id)));
    const onTruck = ids.some(id => !!this.packagesStateService.getProcessedPackageById(id));
    return { count: ids.length, weight, groupNo, anyGrouped, onTruck };
  });
  readonly groupNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  /** Sol tık sürükleyerek kutu seçimi dikdörtgeni (konteyner-göreli px). */
  readonly selectionBox = signal<{ left: number; top: number; width: number; height: number } | null>(null);
  @ViewChild('groupBadgeLayer') groupBadgeLayerRef?: ElementRef<HTMLElement>;

  // Yerel ayna (store'dan efektle senkron) — handler'larda senkron okuma için.
  private multiSet = new Set<string>();
  private isBoxSelecting = false;
  private boxAdditive = false;
  private boxMoved = false;
  private boxOrigin = { x: 0, y: 0 };

  private groupDrag: GroupDragState | null = null;

  private multiSelectionSyncEffect = effect(() => {
    const ids = this.multiSelectedSignal();
    untracked(() => {
      this.multiSet = new Set(ids);
      if (this.isViewReady) {
        this.reapplyMultiEmissive();
        this.renderManager.requestRender();
      }
    });
  });

  get totalWeightDisplay(): string {
    const total = this.processedPackagesSignal()
      .reduce((sum, pkg) => sum + (pkg.weight || 0), 0);
    return this.formatWeight(total);
  }

  protected formatWeight(kg: number): string {
    if (kg >= 1000) return `${(kg / 1000).toFixed(2)} ton`;
    return `${kg.toFixed(0)} kg`;
  }

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
      .pipe(skip(1), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isLocalOperation) {
          this.isLocalOperation = false;
          return;
        }
        // Dışarıdan (step 2 sync / yeniden hesaplama) geldi → konumlar değişti:
        // gruplar ve çoklu seçim geçersiz.
        this.clearAllGroups(true, true);
        this.clearMultiSelection();
        this.safeProcessData().then(() => {
          this.applyGravityToAllPackages();
        });
      });
    document.addEventListener('fullscreenchange', this.onDocFullscreenChange);
  }

  onPrevShipment(): void {
    const idx = this.activeShipmentIndexSignal();
    if (idx > 0) {
      this.store.dispatch(StepperResultActions.setActiveShipment({ index: idx - 1 }));
      this.reset();
      // ÖNEMLİ: isLocalOperation'ı safeProcessData()'dan SONRA true yapıyoruz.
      // safeProcessData() senkron çalışır (içinde await yok) ve İLK satırında
      // isLocalOperation'ı false'a çeker. Bayrağı çağrıdan ÖNCE true yaparsak
      // o an hiçbir işe yaramadan hemen false'a dönüyor; piecesData$
      // aboneliği (yukarıdaki dispatch'in tetiklediği) ise Angular signal
      // effect'leri asenkron/mikrotask ile çalıştığı için bu satırlardan
      // SONRA tetikleniyor — bayrağı false bulup "dışarıdan geldi" sanıp
      // safeProcessData() + applyGravityToAllPackages()'ı bir KEZ DAHA,
      // gereksiz yere çalıştırıyordu. Sonuç: her sevkiyat geçişinde TÜM
      // sahne iki kez kuruluyordu — geçişlerin yavaş hissetmesinin asıl
      // nedenlerinden biri buydu.
      this.safeProcessData();
      this.isLocalOperation = true;
    }
  }

  onNextShipment(): void {
    const idx = this.activeShipmentIndexSignal();
    if (idx < this.shipmentsSignal().length - 1) {
      this.store.dispatch(StepperResultActions.setActiveShipment({ index: idx + 1 }));
      this.reset();
      // bkz. onPrevShipment() — aynı çifte-kurulum düzeltmesi.
      this.safeProcessData();
      this.isLocalOperation = true;
    }
  }

  public suppressNextStoreSync(): void {
    this.isLocalOperation = true;
  }

  private hasChangePerm(): boolean {
    return this.permissions()?.includes('orders.change_orderresult') ?? false;
  }

  public async safeProcessData(): Promise<void> {
    if (this.isDestroyed || !this.isViewReady) return;

    this.isLocalOperation = false;

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

  /**
   * Bir Object3D'nin TÜM alt ağacını (kendisi dahil) dolaşıp geometry,
   * material (ve varsa üzerindeki texture/map) kaynaklarını serbest
   * bırakır. Bir paket mesh'i tek bir kutu değil — kenar çizgileri
   * (EdgesGeometry+LineBasicMaterial), palet alt-grubu (birden çok
   * tahta/blok mesh'i), etiket (CanvasTexture'lı plane/sprite), ürün
   * detay etiketleri ve force-place border'ı gibi ONLARCA alt nesneden
   * oluşan bir hiyerarşi (bkz. createPackageMesh). Sadece üstteki tek
   * mesh'i (veya hiçbirini, `.clear()` gibi) dispose etmek, bu alt
   * nesnelerin GPU/CPU kaynaklarını (özellikle CanvasTexture'lar) sızdırır
   * — sevkiyatlar arası geçişte (her geçişte TÜM sahne yeniden kuruluyor)
   * bu sızıntı hızla birikip fark edilir bir "kasma"ya yol açıyordu.
   */
  private disposeObjectTree(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      // Paylaşılan (palet) kaynaklar başka paketlerce de kullanılıyor — atla.
      if (!mesh.geometry?.userData?.['shared']) {
        mesh.geometry?.dispose();
      }

      const material = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (material) {
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((mat) => {
          if (mat.userData?.['shared']) return;
          const map = (mat as THREE.MeshBasicMaterial).map;
          map?.dispose();
          mat.dispose();
        });
      }
    });
  }

  /**
 * Package mesh'ini temizler
 */
  private cleanupMesh(pkg: PackageData): void {

    if (pkg.mesh) {
      this.packagesGroup.remove(pkg.mesh);
      this.disposeObjectTree(pkg.mesh);
      pkg.mesh = undefined;
      pkg.detailLabelMeshes = undefined;
      // forcePlaceBorder mesh'in bir ÇOCUĞUYDU (bkz. addForcePlaceBorder) —
      // yukarıdaki disposeObjectTree zaten onu da kapsadı, referansı
      // temizlemek yeterli.
      pkg.forcePlaceBorder = undefined;
    } else if (pkg.forcePlaceBorder) {
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
    this.store.dispatch(PackageGroupsActions.clearMultiSelection());
    document.removeEventListener('mouseup', this.onDocMouseUp);
    document.removeEventListener('touchstart', this.onDocTouchStart);
    document.removeEventListener('touchmove', this.onDocTouchMove);
    document.removeEventListener('touchend', this.onDocTouchEnd);
    document.removeEventListener('touchcancel', this.onDocTouchEnd);
    document.removeEventListener('fullscreenchange', this.onDocFullscreenChange);
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

    // Kalan alandan arka boşluk (rear_clearance_mm) düşülür
    const truckLength = this.truckDimension()[0] - this.rearClearanceSignal();
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

  /**
   * selectedPackageProducts ile AYNI eşleştirme, plate'te (bekleme
   * alanı) seçili paket için — detay panelinin ürün listesi bölümü orada
   * da görünsün diye (bkz. selectedPlatePackageSignal).
   */
  get selectedPlatePackageProducts(): any[] {
    const selected = this.selectedPlatePackageSignal();
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

    // Normale döndürülürken hâlâ başka bir paketin içindeyse uyar
    // (rozet de paketin üstünde kalır — bkz. refreshOverlapWarnings).
    if (this.overlapWarningsSignal().some(w => w.pkgId === selected.pkgId)) {
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.WARN_NORMALIZE_OVERLAP'));
    }
    this.renderManager.requestRender();
    this.cdr.detectChanges();
  }

  /**
   * Seçili paketin üstünde onu takip eden hızlı-aksiyon halkasının (döndür/
   * sil/zorla yerleştir) ekran konumunu günceller. Render loop'un HER
   * frame'inde (bkz. startRenderLoop çağrısındaki onFrameCallback) NgZone
   * DIŞINDA çağrılır — bu yüzden Angular sinyali/CD kullanmak yerine
   * doğrudan DOM style yazıyoruz (aksi halde 60fps'te her karede change
   * detection tetiklemek gereksiz maliyet olurdu; mevcut kodda da renderer
   * cursor'ı aynı şekilde doğrudan style ile yönetiliyor).
   */
  private updateActionRingPosition(): void {
    const ringEl = this.actionRingRef?.nativeElement;
    if (!ringEl) return;

    const selected = this.selectedPackageSignal();
    if (!selected?.mesh || !this.camera || !this.threeContainer) {
      ringEl.style.display = 'none';
      return;
    }

    const container = this.threeContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) {
      ringEl.style.display = 'none';
      return;
    }

    // Mesh (veya bir üst grubu) YENİ eklendiyse matrixWorld'ü henüz hiç
    // render'dan geçmemiş olabilir (varsayılan/eski değerde kalır) — bu
    // durumda getWorldPosition YANLIŞ (ör. 0,0,0'a yakın, ekranın sol-üst
    // köşesine izdüşen) bir konum döndürür ve halka bir kare boyunca
    // köşede "flaşlar". Projeksiyondan ÖNCE matrisi elle güncelleyerek bunu
    // render zamanlamasından bağımsız hale getiriyoruz.
    this.packagesGroup?.updateMatrixWorld(true);

    // Kutunun tam dünya konumu (packagesGroup'un kendi transformu dahil) +
    // kutunun üstünden biraz yukarısı, ki halka paketin üstünde asılı dursun.
    selected.mesh.getWorldPosition(this.ringProjectionVector);
    this.ringProjectionVector.y += selected.height / 2 + 180;
    this.ringProjectionVector.project(this.camera);

    // z > 1 → nokta kameranın arkasında/uzağında, gösterme
    if (this.ringProjectionVector.z > 1) {
      ringEl.style.display = 'none';
      return;
    }

    const x = (this.ringProjectionVector.x * 0.5 + 0.5) * width;
    const y = (-this.ringProjectionVector.y * 0.5 + 0.5) * height - this.RING_VERTICAL_GAP;

    ringEl.style.display = 'flex';
    ringEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  /**
   * updateActionRingPosition ile aynı mantık, plate'te seçili paket için
   * (bkz. selectedPlatePackageSignal). İki halka aynı anda görünmez (biri
   * seçilince diğeri temizlenir), ama kod tekrarını önlemek yerine ayrı
   * tutuyoruz çünkü büyümesi/işlevi ilerde farklılaşabilir (ör. plate
   * halkasında sadece 2 buton var).
   */
  private updatePlateActionRingPosition(): void {
    const ringEl = this.plateActionRingRef?.nativeElement;
    if (!ringEl) return;

    const selected = this.selectedPlatePackageSignal();
    if (!selected?.mesh || !this.camera || !this.threeContainer) {
      ringEl.style.display = 'none';
      return;
    }

    const container = this.threeContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) {
      ringEl.style.display = 'none';
      return;
    }

    // Aynı flaş sorununa karşı — bkz. updateActionRingPosition'daki not.
    // Plate mesh'leri özellikle sık dispose+yeniden-oluşturuluyor (bkz.
    // refreshSinglePlatePackageMesh/createPlateVisualization), bu yüzden
    // burada matrisin taze olduğundan emin olmak daha kritik.
    this.plateGroup?.updateMatrixWorld(true);

    selected.mesh.getWorldPosition(this.ringProjectionVector);
    this.ringProjectionVector.y += selected.height / 2 + 180;
    this.ringProjectionVector.project(this.camera);

    if (this.ringProjectionVector.z > 1) {
      ringEl.style.display = 'none';
      return;
    }

    const x = (this.ringProjectionVector.x * 0.5 + 0.5) * width;
    const y = (-this.ringProjectionVector.y * 0.5 + 0.5) * height - this.RING_VERTICAL_GAP;

    ringEl.style.display = 'flex';
    ringEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
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
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.packagesGroup = this.threeComponents.packagesGroup;

      // Plate (bekleme alanı) grubu — tırın yanında (Z ekseni), yerleşmeyen
      // paketlerin 3D gösterileceği alan. packagesGroup ile aynı Y offset'i
      // (truck bed yüksekliği), X=0, Z tır genişliğinin ötesinde.
      this.plateGroup = new THREE.Group();
      this.scene.add(this.plateGroup);
      this.positionPlateGroup();

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
        this.camera,
        () => {
          this.updateActionRingPosition();
          this.updatePlateActionRingPosition();
          this.updateOverlapBadgePositions();
          this.updateGroupBadgePositions();
        }
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
      this.syncDeletedPackagesCache(this.store.selectSignal(selectDeletedPackages)());
      // Cache (root servis) zaten dolu olabilir → signal değişmez, plateVisualizationSyncEffect
      // tetiklenmez ve yeni sahnede plate boş kalır. İlk kurulumu açıkça yap.
      this.createPlateVisualization();
      this.renderManager.requestRender();
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

  private syncDeletedPackagesCache(deletedRows: PackagePosition[]): void {
    const storePkgIds = new Set(deletedRows.map(row => row[8]));
    const currentCache = this.packagesStateService.deletedPackages();
    const cacheIds = new Set(currentCache.map(p => p.pkgId));

    const toAdd: PackageData[] = deletedRows
      .filter(row => !cacheIds.has(row[8]))
      .map(row => ({
        id: row[6],
        x: -1, y: -1, z: -1,
        length: row[3],
        width: row[4],
        height: row[5],
        weight: row[7],
        pkgId: row[8],
        dimensions: `${row[3]}×${row[4]}×${row[5]} mm`,
        color: this.getUniqueColor(),
        originalColor: undefined,
        isBeingDragged: false,
      } as PackageData));

    if (toAdd.length > 0) {
      this.packagesStateService.addToDeletedPackages(toAdd);
    }

    const toRemove = currentCache
      .filter(p => !storePkgIds.has(p.pkgId))
      .map(p => p.pkgId);

    if (toRemove.length > 0) {
      this.packagesStateService.removeFromDeletedPackages(toRemove);
    }
  }

  private processData(): void {
    const pieces = this.piecesDataSignal();

    if (!pieces || pieces.length === 0) {
      this.packagesStateService.clearProcessedPackages();
      this.usedColors.clear();
      return;
    }

    const stateMap = new Map();
    this.processedPackagesSignal().forEach(pkg => {
      stateMap.set(pkg.pkgId, {
        color: pkg.color,
        originalColor: pkg.originalColor,
        rotation: pkg.rotation || 0,
        originalLength: pkg.originalLength,
        originalWidth: pkg.originalWidth,
        isForcePlaced: pkg.isForcePlaced || false
      });
    });

    const processed: PackageData[] = [];

    pieces.forEach((piece: any) => {
      const pkgId = piece[8];
      const saved = stateMap.get(pkgId);

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

      const color = saved?.color || this.getUniqueColor();
      const originalColor = saved?.originalColor || color;

      processed.push({
        id: piece[6],
        x: piece[0] || 0,
        y: piece[1] || 0,
        z: piece[2] || 0,
        length, width,
        height: piece[5] || 0,
        weight: piece[7] || 0,
        color, originalColor, rotation, originalLength, originalWidth,
        dimensions: `${length}×${width}×${piece[5] || 0} mm`,
        isBeingDragged: false,
        pkgId: piece[8],
        isForcePlaced: saved?.isForcePlaced || false
      });
    });

    this.packagesStateService.setProcessedPackages(processed);
  }

  private createPackageVisualization(): void {
    if (!this.packagesGroup) return;

    // Önceki sahne ağacını tamamen dispose et (geometry/material/texture),
    // sonra grubu boşalt. .clear() tek başına yalnızca çocukları sahneden
    // koparır, kaynaklarını serbest bırakmaz — bu satır, sevkiyatlar arası
    // geçişte biriken GPU/CPU sızıntısının (ve buna bağlı kasmanın) kök
    // nedeniydi.
    this.disposeObjectTree(this.packagesGroup);
    this.packagesGroup.clear();

    this.processedPackagesSignal().forEach((packageData) => {
      this.createPackageMesh(packageData);
    });

    this.ngZone.run(() => {
      this.cdr.markForCheck();
    });
  }

  private createPackageMesh(packageData: PackageData): void {
    const mesh = this.buildPackageMeshObject(packageData);
    packageData.mesh = mesh;
    this.packagesGroup.add(mesh);
  }

  // ========================================
  // PLATE (BEKLEME ALANI)
  // ========================================

  /**
   * plateGroup'un dünya konumunu ayarlar — tırın yanında (Z ekseninde),
   * packagesGroup ile aynı Y offset'inde (truck bed yüksekliği). Truck
   * boyutu değiştiğinde (ör. farklı sevkiyat/tır) yeniden çağrılabilir.
   */
  private positionPlateGroup(): void {
    if (!this.plateGroup) return;
    const truckDims = this.truckDimension();
    this.plateGroup.position.set(
      0,
      this.packagesGroup?.position.y ?? 1100,
      truckDims[1] + this.PLATE_GAP
    );
  }

  /**
   * Yerleşmeyen paketleri konumlandırır. Kullanıcı artık plate üzerinde
   * paketleri istediği yere serbestçe sürükleyebildiği için (çakışma
   * kontrolü YOK), burada zaten geçerli bir plate-local konumu olan
   * paketlerin (pkg.x/pkg.y >= 0) yerini KORUYORUZ — sadece henüz hiç
   * konum atanmamış (sentinel: x === -1, bkz. reset() / finalizeDragToPlate)
   * paketler basit bir sol-sağ/satır grid'ine dizilir. Bu, gerçek
   * bin-packing değil — bu alan bir "bekleme rafı", amaç paketleri gerçek
   * 3D halleriyle görünür ve tıklanabilir/sürüklenebilir kılmak, optimum
   * yerleşim değil. Satır genişliği plate'in X eksenindeki maxWidth'ini
   * aşınca bir alt satıra geçilir.
   */
  private computePlateLayout(
    packages: PackageData[],
    maxWidth: number
  ): { slots: Map<string, { x: number; z: number }>; usedDepth: number } {
    const slots = new Map<string, { x: number; z: number }>();
    const gap = this.PLATE_ITEM_GAP;
    let usedDepth = gap;

    // Önce mevcut (kullanıcının serbestçe yerleştirdiği) konumları koru —
    // usedDepth hesaplamasına dahil et ki plate zemini/derinliği bu
    // paketleri de kapsasın. Bu dikdörtgenleri, aşağıdaki grid taramasının
    // ÇAKIŞMA kontrolünde de kullanıyoruz — aksi halde yeni silinen bir
    // paket, kullanıcının serbestçe yerleştirdiği bir paketin TAM ÜZERİNE
    // (satır/sütun kör bir kursörle) yerleştirilebiliyordu.
    const placedRects: Array<{ x: number; z: number; length: number; width: number }> = [];
    for (const pkg of packages) {
      if (pkg.x >= 0 && pkg.y >= 0) {
        slots.set(pkg.pkgId, { x: pkg.x, z: pkg.y });
        placedRects.push({ x: pkg.x, z: pkg.y, length: pkg.length, width: pkg.width });
        usedDepth = Math.max(usedDepth, pkg.y + pkg.width + gap);
      }
    }

    const overlapsAny = (x: number, z: number, length: number, width: number): boolean => {
      for (const r of placedRects) {
        const separatedOnX = x + length + gap <= r.x || r.x + r.length + gap <= x;
        const separatedOnZ = z + width + gap <= r.z || r.z + r.width + gap <= z;
        if (!separatedOnX && !separatedOnZ) return true;
      }
      return false;
    };

    // Henüz konumu olmayan (yeni silinmiş) paketleri, MEVCUT paketlerle
    // (ve bu döngüde daha önce yerleştirilenlerle) çakışmayacak ilk boş
    // yere diz — satır satır tarayıp uygun bir boşluk bulunca yerleştirir.
    const step = 100;
    for (const pkg of packages) {
      if (pkg.x >= 0 && pkg.y >= 0) continue;

      const footprintX = pkg.length;
      const footprintZ = pkg.width;
      let placed: { x: number; z: number } | undefined;

      zScan:
      for (let z = gap; z <= usedDepth + 20000; z += step) {
        for (let x = gap; x + footprintX + gap <= maxWidth; x += step) {
          if (!overlapsAny(x, z, footprintX, footprintZ)) {
            placed = { x, z };
            break zScan;
          }
        }
      }

      if (!placed) {
        // Hiç boşluk bulunamadıysa (aşırı kalabalık) — mevcut derinliğin altına ekle.
        placed = { x: gap, z: usedDepth };
      }

      slots.set(pkg.pkgId, placed);
      placedRects.push({ x: placed.x, z: placed.z, length: footprintX, width: footprintZ });
      usedDepth = Math.max(usedDepth, placed.z + footprintZ + gap);
    }

    return { slots, usedDepth };
  }

  /**
   * Plate'in zemin/raf mesh'ini (görsel amaçlı, tırın platformuna benzer)
   * oluşturur/günceller. plateGroup dispose+clear edildikten SONRA
   * çağrılmalı (createPlateVisualization sırası).
   */
  private createOrUpdatePlateFloor(width: number, depth: number): void {
    const floorHeight = 200;
    const geometry = new THREE.BoxGeometry(width, floorHeight, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x5c6b73,
      metalness: 0.2,
      roughness: 0.85
    });

    const floor = new THREE.Mesh(geometry, material);
    floor.position.set(width / 2, -floorHeight / 2, depth / 2);
    floor.receiveShadow = true;

    this.plateFloorMesh = floor;
    this.plateGroup.add(floor);
  }

  /**
   * Plate görselleştirmesini komple yeniden kurar — packagesStateService.
   * deletedPackages() her değiştiğinde (bkz. plateVisualizationSyncEffect)
   * otomatik tetiklenir. createPackageVisualization ile aynı desen:
   * önce eski ağacı tamamen dispose et, sonra sıfırdan kur.
   */
  private createPlateVisualization(): void {
    if (!this.plateGroup) return;

    this.disposeObjectTree(this.plateGroup);
    this.plateGroup.clear();
    this.plateFloorMesh = undefined;

    this.positionPlateGroup();

    const deleted = this.packagesStateService.deletedPackages();
    const truckDims = this.truckDimension();
    const plateWidth = Math.max(truckDims[0], 1000);

    const { slots, usedDepth } = this.computePlateLayout(deleted, plateWidth);
    this.plateDepthCurrent = Math.max(this.PLATE_MIN_DEPTH, usedDepth);

    this.createOrUpdatePlateFloor(plateWidth, this.plateDepthCurrent);

    deleted.forEach(pkg => {
      const slot = slots.get(pkg.pkgId);
      if (!slot) return;
      // Slot'u pkg.x/y'ye kalıcı olarak yaz — böylece bir sonraki
      // createPlateVisualization çağrısında (ör. başka bir paket
      // silindiğinde/geri alındığında) bu paketin konumu computePlateLayout
      // tarafından KORUNUR, yeniden grid'e dizilmez.
      pkg.x = slot.x;
      pkg.y = slot.z;
      pkg.z = 0;
      // Sürükleme sırasında geçici olarak packagesGroup'a alınmış olabilir
      // (bkz. initiateDragging) — burada her zaman plateGroup'a, doğru
      // slot'a göre YENİDEN kuruluyor, o yüzden eski parent önemli değil.
      this.createPlatePackageMesh(pkg, slot);
    });

    this.renderManager.requestRender();
  }

  /**
   * Plate (bekleme alanı) üzerindeki bir paket için mesh oluşturur — tırdaki
   * paketlerle AYNI görsel detay (palet + etiketler), sadece konumu paketin
   * gerçek x/y/z'si yerine plate grid'indeki slot'a göre hesaplanır ve mesh
   * packagesGroup yerine plateGroup'a eklenir. userData.isPlatePackage
   * flag'i ile tıklama/sürükleme mantığı bunun bir plate paketi olduğunu
   * ayırt eder (bkz. getIntersectedAny).
   */
  private createPlatePackageMesh(packageData: PackageData, slot: { x: number; z: number }): void {
    const mesh = this.buildPackageMeshObject(packageData, { x: slot.x, y: slot.z, z: packageData.plateZ ?? 0 });
    mesh.userData['isPlatePackage'] = true;
    packageData.mesh = mesh;
    this.plateGroup.add(mesh);
  }

  /**
   * Plate'te TEK bir paketin mesh'ini (canvas tabanlı etiketleri dahil)
   * yeniden kurar — diğer plate paketlerine HİÇ dokunmaz.
   * createPlateVisualization() tüm plate'i (tüm CanvasTexture'li
   * etiketler dahil) sıfırdan kurduğu için pahalıdır; sadece BU paket
   * değiştiğinde (sürükleyip bırakma, döndürme, drag iptali) tam rebuild
   * yerine bunu kullanıyoruz — aksi halde plate'te çok paket varken her
   * tekil hareket TÜM etiketlerin yeniden çizilmesine (CPU canvas çizimi +
   * GPU texture upload) yol açıyordu. Çağıran taraf pkg.x/pkg.y'yi
   * ÇAĞIRMADAN ÖNCE doğru plate-local değerlere ayarlamış olmalı.
   */
  private refreshSinglePlatePackageMesh(pkg: PackageData): void {
    if (!this.plateGroup) return;

    // Eski mesh'i (hangi parent'ta olursa olsun — plateGroup ya da
    // initiateDragging'in geçici olarak aldığı packagesGroup) temizle.
    if (pkg.mesh) {
      pkg.mesh.parent?.remove(pkg.mesh);
      this.disposeObjectTree(pkg.mesh);
      pkg.mesh = undefined;
    }

    this.createPlatePackageMesh(pkg, { x: pkg.x, z: pkg.y });

    // Paket mevcut zeminin dışına taştıysa zemini büyüt — SADECE zemin
    // mesh'ini yeniler (tek bir kutu geometrisi, ucuz), diğer paket
    // mesh'lerine dokunmaz.
    const neededDepth = pkg.y + pkg.width + this.PLATE_ITEM_GAP;
    if (neededDepth > this.plateDepthCurrent) {
      this.plateDepthCurrent = neededDepth;
      const truckDims = this.truckDimension();
      const plateWidth = Math.max(truckDims[0], 1000);
      if (this.plateFloorMesh) {
        this.plateGroup.remove(this.plateFloorMesh);
        this.disposeObjectTree(this.plateFloorMesh);
        this.plateFloorMesh = undefined;
      }
      this.createOrUpdatePlateFloor(plateWidth, this.plateDepthCurrent);
    }

    this.renderManager.requestRender();
  }

  /**
   * initiateDragging, sürüklemeye BAŞLARKEN (tıklama mı gerçek sürükleme mi
   * olduğu henüz belli değilken) plate paketinin mesh'ini geçici olarak
   * packagesGroup'a alıyor (bkz. initiateDragging'deki not). Eğer sürükleme
   * hiç gerçekleşmediyse (sadece tıklandıysa), pkg.x/y/z zaten değişmedi —
   * bu durumda mesh'i dispose edip YENİDEN KURMAK (refreshSinglePlatePackageMesh)
   * gereksiz pahalı: hem CanvasTexture etiketleri boş yere yeniden çiziliyor
   * hem de bu işlem sırasında halka için bir anlık "eski/yanlış konum"
   * görünme riski yaratıyor. Bunun yerine mesh'i AYNI OBJE olarak, dünya
   * konumunu koruyarak plateGroup'a GERİ taşıyoruz — ucuz ve anlık.
   */
  private revertPlateMeshReparent(pkg: PackageData): void {
    if (!pkg.mesh || pkg.mesh.parent === this.plateGroup) return;

    const worldPos = new THREE.Vector3();
    pkg.mesh.getWorldPosition(worldPos);
    pkg.mesh.parent?.remove(pkg.mesh);
    this.plateGroup.add(pkg.mesh);
    pkg.mesh.position.set(
      worldPos.x - this.plateGroup.position.x,
      worldPos.y - this.plateGroup.position.y,
      worldPos.z - this.plateGroup.position.z
    );
  }

  /**
   * createPackageMesh ve createPlatePackageMesh arasında PAYLAŞILAN mesh
   * inşa mantığı (palet + kutu + kenar çizgileri + ID etiketi + ürün detay
   * etiketleri). `positionOverride` verilmezse packageData.x/y/z kullanılır
   * (tır paketleri); verilirse (plate paketleri) o konum kullanılır — grup
   * ataması ve packageData.mesh ataması caller'a bırakılır.
   */
  private buildPackageMeshObject(
    packageData: PackageData,
    positionOverride?: { x: number; y: number; z: number }
  ): THREE.Mesh {
    const pos = positionOverride ?? packageData;
    const { group: palletGroup, palletHeight } = this.createPalletMesh(packageData.length, packageData.width);

    const visualHeight = packageData.height - palletHeight;

    const geometry = new THREE.BoxGeometry(
      packageData.length,
      visualHeight,
      packageData.width
    );

    // Geometry'yi palet kadar yukarı kaydır (mesh position değişmez)

    // Düşük kalite modunda ucuz (Lambert) materyal: ortam haritası/PBR hesabı yok.
    // Seçim/hover vurgusu sadece `emissive` kullanıyor — iki materyalde de var.
    // (Materyal paket başına ayrı: emissive paket bazında değişiyor, paylaşılamaz.)
    const material: THREE.MeshStandardMaterial = this.quality.cheapMaterials
      ? (new THREE.MeshLambertMaterial({
          color: packageData.color,
          wireframe: this.wireframeMode
        }) as unknown as THREE.MeshStandardMaterial)
      : new THREE.MeshStandardMaterial({
          color: packageData.color,
          roughness: 0.65,
          metalness: 0.01,
          wireframe: this.wireframeMode
        });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(
      pos.x + packageData.length / 2,
      pos.z + palletHeight + visualHeight / 2, // palet + kutunun yarısı
      pos.y + packageData.width / 2
    );

    mesh.castShadow = this.quality.shadows;
    mesh.receiveShadow = this.quality.shadows;
    mesh.userData = { packageData };

    const edges = new THREE.EdgesGeometry(geometry);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.20
    });
    mesh.add(new THREE.LineSegments(edges, lineMat));

    // Palet mesh merkezine göre tam alta
    palletGroup.position.set(
      -packageData.length / 2,
      -packageData.height / 2 - palletHeight / 2,  // mesh merkezinden palet tabanına
      -packageData.width / 2
    );
    mesh.add(palletGroup);

    if (packageData.isForcePlaced) {
      this.addForcePlaceBorder(packageData);
    }
    // ID etiketi — kutunun merkezinde, her zaman kameraya bakar
    const label = this.createPackageLabel(packageData);
    // Kutunun üstüne — y ekseninde mesh'in tepesi + biraz boşluk
    label.position.set(0, packageData.height / 2 + 100, 0);
    mesh.add(label);

    // Ürün detay etiketleri — üst YÜZEY + 4 yan yüzey. Üst üste dizilen
    // paketlerde üsttekinin alt yüzeyi bir altındakinin üst yüzeyini
    // kapatabildiği için sadece üste eklemek yetmiyordu — yanlar her zaman
    // (komşu paket tam bitişik olmadığı sürece) görünür kalıyor. Sadece
    // mouse üzerine gelince görünür (bkz. updateHoverEffects()).
    //
    // PERFORMANS: Her paket için 5 adet büyük canvas texture (üst + 4 yan) RAM'i
    // en çok tüketen kalemdi. Artık etiketler TEMBEL üretilir: sadece "her zaman
    // göster" açıksa şimdi, değilse paket ilk kez hover edildiğinde
    // (bkz. ensureDetailLabels / updateHoverEffects).
    packageData.detailLabelMeshes = undefined;
    if (this.showAllPackageLabels) {
      this.ensureDetailLabels(packageData, mesh, visualHeight);
    }

    return mesh;
  }

  /** Palet yüksekliği — createPalletMesh ile AYNI formül (etiket/boyut hesapları için). */
  private getPalletHeight(pkgLength: number, pkgWidth: number): number {
    const boardThick = Math.max(18, pkgWidth * 0.018);
    const blockH = Math.max(70, pkgLength * 0.045);
    return boardThick * 2 + blockH;
  }

  /**
   * Ürün detay etiketlerini (üst + 4 yan yüz) gerektiğinde üretip pakete ekler.
   * Zaten üretilmişse bir şey yapmaz. Etiket verisi yoksa boş kalır.
   */
  private ensureDetailLabels(
    packageData: PackageData,
    meshArg?: THREE.Mesh,
    visualHeightArg?: number
  ): void {
    if (packageData.detailLabelMeshes) return;
    const mesh = meshArg ?? packageData.mesh;
    if (!mesh) return;

    const visualHeight = visualHeightArg
      ?? (packageData.height - this.getPalletHeight(packageData.length, packageData.width));
    const labels = this.createPackageDetailLabels(packageData, visualHeight);
    if (labels.length === 0) return;

    labels.forEach(l => mesh.add(l));
    packageData.detailLabelMeshes = labels;
  }

  /** Düşük kalite modunda görünmeyen etiketlerin texture'larını serbest bırakır (RAM). */
  private releaseDetailLabels(packageData: PackageData): void {
    const labels = packageData.detailLabelMeshes;
    if (!labels) return;
    labels.forEach(l => {
      l.parent?.remove(l);
      this.disposeObjectTree(l);
    });
    packageData.detailLabelMeshes = undefined;
  }

  /**
   * Paketin üst + 4 yan yüzeyi için ayrı ayrı ürün adı/adet etiketi (plane
   * mesh) üretir; hepsi başlangıçta gizli döner (visible=false), sadece
   * updateHoverEffects() üzerinden açılır. Ürün bilgisi bulunamazsa
   * (state'te eşleşen paket/ürün yoksa) boş dizi döner.
   */
  private createPackageDetailLabels(
    packageData: PackageData,
    visualHeight: number
  ): THREE.Mesh[] {
    const lines = this.getPackageDetailLines(packageData);
    if (lines.length === 0) return [];

    const halfLength = packageData.length / 2;
    const halfWidth = packageData.width / 2;
    const halfHeight = visualHeight / 2;
    const eps = 2; // z-fighting'i önlemek için yüzeyden ufak dışa offset

    const labels: THREE.Mesh[] = [];

    // Üst yüzey (length × width) — normal +Y
    const top = this.createFaceLabelPlane(lines, packageData.length, packageData.width);
    if (top) {
      top.rotation.x = -Math.PI / 2;
      top.position.set(0, halfHeight + eps, 0);
      labels.push(top);
    }

    // Ön yüzey +Z (length × height) — normal +Z (varsayılan)
    const front = this.createFaceLabelPlane(lines, packageData.length, visualHeight);
    if (front) {
      front.position.set(0, 0, halfWidth + eps);
      labels.push(front);
    }

    // Arka yüzey -Z (length × height) — normal -Z
    const back = this.createFaceLabelPlane(lines, packageData.length, visualHeight);
    if (back) {
      back.rotation.y = Math.PI;
      back.position.set(0, 0, -halfWidth - eps);
      labels.push(back);
    }

    // Sol yüzey -X (width × height) — normal -X
    const left = this.createFaceLabelPlane(lines, packageData.width, visualHeight);
    if (left) {
      left.rotation.y = -Math.PI / 2;
      left.position.set(-halfLength - eps, 0, 0);
      labels.push(left);
    }

    // Sağ yüzey +X (width × height) — normal +X
    const right = this.createFaceLabelPlane(lines, packageData.width, visualHeight);
    if (right) {
      right.rotation.y = Math.PI / 2;
      right.position.set(halfLength + eps, 0, 0);
      labels.push(right);
    }

    // Sayfa yenilendiğinde localStorage'dan "her zaman göster" tercihi
    // açık geliyorsa etiketler ilk andan itibaren görünür olmalı — sadece
    // hover'a bağlı kalırsa kullanıcı mouse hareket ettirene kadar hiçbiri
    // görünmez kalırdı.
    labels.forEach(l => (l.visible = this.showAllPackageLabels));
    return labels;
  }

  /**
   * faceW × faceH boyutunda (dünya birimi, mm) bir plane mesh döner; verilen
   * satırlar yüzeye SIĞACAK şekilde (yatay / çapraz / dik — hangisi en büyük
   * okunabilir font boyutunu veriyorsa o) otomatik döndürülüp çizilir.
   * Konum/rotasyon caller tarafından ayarlanır (hangi yüz olduğuna göre
   * değişir). Hiçbir açıda okunabilir boyutta sığmazsa null döner.
   */
  private createFaceLabelPlane(
    lines: string[],
    faceW: number,
    faceH: number
  ): THREE.Mesh | null {
    // Canvas çözünürlüğü — gerçek yüzey oranını korur, en büyük kenar 1024'ü
    // geçmesin (performans).
    const maxRes = this.quality.detailLabelMaxRes;
    const aspect = faceW / faceH;
    const canvasWidth = aspect >= 1 ? maxRes : Math.round(maxRes * aspect);
    const canvasHeight = aspect >= 1 ? Math.round(maxRes / aspect) : maxRes;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    const fit = this.fitTextBlock(ctx, lines, canvasWidth, canvasHeight);
    if (!fit) return null; // hiçbir açıda okunabilir boyutta sığmadı

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate(fit.angle);

    ctx.font = `bold ${fit.fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, fit.fontSize * 0.08);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = '#ffffff';

    const lineHeight = fit.fontSize * fit.lineHeightRatio;
    const startY = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      ctx.strokeText(line, 0, y);
      ctx.fillText(line, 0, y);
    });
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    if (this.quality.richTextures) {
      texture.anisotropy = 4;
    } else {
      // Mipmap üretimi GPU belleğini ~%33 artırır; düşük modda kapalı.
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.anisotropy = 1;
    }

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(faceW, faceH), material);
    plane.renderOrder = 998;
    // ÖNEMLİ: Bu plane'ler kutu yüzeyinin tam dışında duruyor (front/back/
    // left/right yüzeyler kutunun gerçek dış sınırında). Three.js raycaster
    // invisible objeleri otomatik atlamaz ve bu plane'lerde userData yok —
    // filtrelenmezse tıklama/sürükleme/hover ray'i kutu yerine bu etiketlere
    // çarpıp null dönebilir (seçim ve sürükleme tamamen bozulur). Bu yüzden
    // raycast'i no-op yapıp bu mesh'leri tamamen "tıklanamaz" hale getiriyoruz;
    // tüm etkileşim mantığı hep asıl kutu mesh'ine (userData.packageData
    // olan) düşer.
    plane.raycast = () => {};
    return plane;
  }

  /**
   * Verilen satırları canvas'a yatay (0°), çapraz (yüzeyin köşegen açısı)
   * ve dik (90°) olarak sığdırmayı dener; uygun adaylar için padding
   * içinde kalacak EN BÜYÜK font boyutunu hesaplar ve en büyüğünü (en
   * okunabilir olanı) döndürür. Hiçbiri asgari okunabilir boyuta (12px)
   * ulaşamazsa null döner (etiket hiç eklenmez — karmaşaya yol açmasın).
   *
   * Çapraz yazım SADECE tek satırlık (tek ürünlü) etiketlerde denenir —
   * birden fazla satır çapraz dizildiğinde satırlar birbirine paralel
   * kaymış gibi görünüp okunması zorlaşıyor. Çok ürünlü paketlerde satırlar
   * her zaman yatay ya da (sığmazsa) dik "alt alta" dizilir, hiçbir zaman
   * çapraz olmaz.
   */
  private fitTextBlock(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    canvasWidth: number,
    canvasHeight: number
  ): { angle: number; fontSize: number; lineHeightRatio: number } | null {
    const padding = Math.min(canvasWidth, canvasHeight) * 0.08;
    const diagonal = Math.sqrt(canvasWidth ** 2 + canvasHeight ** 2);
    const diagonalAngle = Math.atan2(canvasHeight, canvasWidth);

    const candidates: { angle: number; availableWidth: number; availableHeight: number }[] = [
      { angle: 0, availableWidth: canvasWidth - padding * 2, availableHeight: canvasHeight - padding * 2 },
      { angle: -Math.PI / 2, availableWidth: canvasHeight - padding * 2, availableHeight: canvasWidth - padding * 2 },
    ];

    if (lines.length === 1) {
      candidates.push({
        angle: -diagonalAngle,
        availableWidth: diagonal - padding * 2,
        availableHeight: Math.min(canvasWidth, canvasHeight) - padding,
      });
    }

    // Çok satırlı (5-7+ ürünlü) paketlerde satırlar daha sıkışık dizilir
    // (dar satır aralığı) ve daha küçük asgari font boyutuna izin verilir —
    // aksi halde uzun ürün listeleri hiçbir açıda sığmayıp etiket tamamen
    // iptal edilirdi (bkz. getPackageDetailLines'daki "+N ürün daha" kırpma
    // ile birlikte çalışır).
    const lineHeightRatio = lines.length >= 6 ? 1.05 : lines.length >= 4 ? 1.15 : 1.25;
    const MIN_FONT = lines.length >= 6 ? 8 : lines.length >= 4 ? 10 : 12;
    const MAX_FONT = Math.min(canvasWidth, canvasHeight) * 0.22;

    // "Sığar mı" testi bir fontSize'da: küçük font her zaman daha kolay sığar
    // (monoton azalan bir fonksiyon) — bu sayede en büyük sığan tam sayı
    // boyutunu 1px'lik adımlarla TEK TEK denemek yerine ikili arama ile
    // ~log2(MAX_FONT-MIN_FONT) adımda bulabiliyoruz (öncesinde 200+ adıma
    // kadar çıkabiliyordu). Bu fonksiyon her paket için 5 yüze (üst/ön/arka/
    // sol/sağ) kadar, her yüz için 2-3 açı adayına kadar çağrılıyor ve HER
    // sevkiyat geçişinde (tam sahne yeniden kurulumunda) TÜM paketler için
    // tekrar çalışıyor — linear tarama, gerçek darboğazlardan biriydi.
    const fitsAt = (
      candidate: { availableWidth: number; availableHeight: number },
      fontSize: number
    ): boolean => {
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
      const totalHeight = lines.length * fontSize * lineHeightRatio;
      return maxLineWidth <= candidate.availableWidth && totalHeight <= candidate.availableHeight;
    };

    let best: { angle: number; fontSize: number } | null = null;

    const maxInt = Math.floor(MAX_FONT);
    const minInt = Math.ceil(MIN_FONT);

    for (const candidate of candidates) {
      let fontSize = minInt - 1; // sentinel: hiçbir boyutta sığmadı

      if (maxInt >= minInt) {
        if (fitsAt(candidate, maxInt)) {
          fontSize = maxInt; // en büyük boyut zaten sığıyor
        } else if (fitsAt(candidate, minInt)) {
          // en büyük sığan tam sayı boyutunu ikili arama ile bul
          let lo = minInt;
          let hi = maxInt;
          while (hi - lo > 1) {
            const mid = Math.floor((lo + hi) / 2);
            if (fitsAt(candidate, mid)) {
              lo = mid;
            } else {
              hi = mid;
            }
          }
          fontSize = lo;
        }
        // ne maxInt ne minInt sığıyorsa bu aday hiçbir boyutta sığmıyor demektir
      }

      if (fontSize >= MIN_FONT && (!best || fontSize > best.fontSize)) {
        best = { angle: candidate.angle, fontSize };
      }
    }

    return best ? { ...best, lineHeightRatio } : null;
  }

  /**
   * pkgId ile state'teki gerçek Package kaydını (product bilgisi dahil)
   * eşleştirir — bkz. selectedPackageProducts getter'ındaki AYNI eşleştirme
   * (pkg.id === pkgId). Birden fazla ürün varsa her biri ayrı satır olur.
   * Bir palette 5-7+ ürün olabildiği için satır sayısı MAX_LINES ile
   * sınırlanır; aşan kısım "+N ürün daha" özet satırına indirgenir (aksi
   * halde fitTextBlock hiçbir açıda sığdıramayıp etiketi tamamen iptal
   * edebilirdi).
   */
  private getPackageDetailLines(packageData: PackageData): string[] {
    const packages = this.packagesSignal();
    const matchedPackage = Object.values(packages).find(
      (pkg: any) => pkg.id === packageData.pkgId
    ) as any;

    const details = matchedPackage?.package_details;
    if (!details || !details.length) return [];

    const named = details.filter((d: any) => d?.product?.name);
    if (!named.length) return [];

    // İsimden son noktayı ve sonrasını silen yardımcı fonksiyon
    const formatName = (name: string) => {
      const lastDotIndex = name.lastIndexOf('.');
      // Eğer nokta bulunursa son noktaya kadar olan kısmı al, yoksa ismin tamamını döndür
      return lastDotIndex > -1 ? name.substring(0, lastDotIndex) : name;
    };

    const MAX_LINES = 8;
    if (named.length <= MAX_LINES) {
      return named.map((d: any) => `${formatName(d.product.name)} × ${d.count}`);
    }

    const shown = named.slice(0, MAX_LINES - 1).map((d: any) => `${formatName(d.product.name)} × ${d.count}`);
    const remaining = named.length - (MAX_LINES - 1);
    shown.push(`+${remaining} ürün daha`);
    return shown;
}

  private createPackageLabel(packageData: PackageData): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 256;

    // Yarı saydam arka plan — yazının arkasında padding kadar
    const padding = 40;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(padding, padding, canvas.width - padding * 2, canvas.height - padding * 2);

    ctx.font = 'bold 140px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(`#${packageData.id}`, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`#${packageData.id}`, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    if (this.quality.richTextures) {
      texture.anisotropy = 4;
    } else {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.anisotropy = 1;
    }

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 999;

    // 400 → 600 (biraz büyüdü)
    const fixedSize = 600;
    sprite.scale.set(fixedSize, fixedSize / 2, 1);

    return sprite;
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
    // PERFORMANS: Palet geometrisi sadece (uzunluk × en)'e bağlı. Eskiden her paket
    // ~19 ayrı Mesh + 19 BoxGeometry + 2 materyal üretiyordu. Şimdi boyuta göre
    // TEK sefer, açık/koyu tahta olarak 2 birleşik geometriye indirilip paketler
    // arasında paylaşılıyor (paket başına 2 draw call, geometri/materyal kopyası yok).
    const key = `${Math.round(pkgLength)}x${Math.round(pkgWidth)}`;
    let entry = this.palletGeometryCache.get(key);
    if (!entry) {
      entry = this.buildPalletGeometries(pkgLength, pkgWidth);
      this.palletGeometryCache.set(key, entry);
    }

    if (!this.sharedPalletMaterials) {
      const make = (color: number, roughness: number): THREE.Material => {
        const m = this.quality.cheapMaterials
          ? new THREE.MeshLambertMaterial({ color })
          : new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.0 });
        m.userData['shared'] = true;
        return m;
      };
      this.sharedPalletMaterials = {
        light: make(0xC4A265, 0.92),
        dark: make(0xA07840, 0.95),
      };
    }

    const group = new THREE.Group();
    const shadows = this.quality.shadows;
    const light = new THREE.Mesh(entry.light, this.sharedPalletMaterials.light);
    const dark = new THREE.Mesh(entry.dark, this.sharedPalletMaterials.dark);
    [light, dark].forEach(m => {
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      group.add(m);
    });

    // Palet grubunun origin'i palet tabanı (y=0) → üst yüzeyi y=PALLET_H
    return { group, palletHeight: entry.height };
  }

  /** Verilen boyuta göre açık/koyu tahta birleşik palet geometrilerini üretir. */
  private buildPalletGeometries(
    pkgLength: number,
    pkgWidth: number
  ): { light: THREE.BufferGeometry; dark: THREE.BufferGeometry; height: number } {
    // --- Boyutlar ---
    const BOARD_THICK = Math.max(18, pkgWidth * 0.018); // üst/alt tahta kalınlığı
    const BLOCK_H = Math.max(70, pkgLength * 0.045); // blok yüksekliği
    const PALLET_H = BOARD_THICK * 2 + BLOCK_H;       // toplam palet yüksekliği ~140mm
    const BOARD_GAP = pkgWidth * 0.03;                 // tahtalar arası boşluk
    const BOARD_COUNT = 7;
    const BLOCK_W = Math.min(pkgLength * 0.10, 120); // blok eni

    type Box = { w: number; h: number; d: number; x: number; y: number; z: number };
    const light: Box[] = [];
    const dark: Box[] = [];

    // ── 1. ÜST TAHTALAR ─────────────────────────────────────────────────────
    // 7 tahta, Z ekseninde eşit aralıklı, length boyunca uzanıyor
    const totalGap = BOARD_GAP * (BOARD_COUNT - 1);
    const boardDepth = (pkgWidth - totalGap) / BOARD_COUNT;
    const topY = PALLET_H - BOARD_THICK / 2; // palet tepesi

    for (let i = 0; i < BOARD_COUNT; i++) {
      const zPos = boardDepth / 2 + i * (boardDepth + BOARD_GAP);
      (i % 2 === 0 ? light : dark).push({
        w: pkgLength, h: BOARD_THICK, d: boardDepth,
        x: pkgLength / 2, y: topY, z: zPos,
      });
    }

    // ── 2. ORTA DESTEK BLOKLARI ──────────────────────────────────────────────
    // 3×3 grid — hem X hem Z ekseninde 3 sıra
    const blockXPositions = [pkgLength * 0.12, pkgLength * 0.50, pkgLength * 0.88];
    const blockZPositions = [pkgWidth * 0.12, pkgWidth * 0.50, pkgWidth * 0.88];
    const blockY = BOARD_THICK + BLOCK_H / 2;

    for (const bx of blockXPositions) {
      for (const bz of blockZPositions) {
        dark.push({ w: BLOCK_W, h: BLOCK_H, d: BLOCK_W, x: bx, y: blockY, z: bz });
      }
    }

    // ── 3. ALT KIZAKLAR ──────────────────────────────────────────────────────
    // 3 kızak, length boyunca uzanıyor, Z ekseninde blok hizasında
    const runnerW = BLOCK_W * 1.1; // bloktan biraz geniş
    const runnerY = BOARD_THICK / 2;

    for (const rz of blockZPositions) {
      light.push({ w: pkgLength, h: BOARD_THICK, d: runnerW, x: pkgLength / 2, y: runnerY, z: rz });
    }

    const lightGeo = this.mergeBoxes(light);
    const darkGeo = this.mergeBoxes(dark);
    lightGeo.userData['shared'] = true;
    darkGeo.userData['shared'] = true;
    return { light: lightGeo, dark: darkGeo, height: PALLET_H };
  }

  /** Kutu listesini tek bir BufferGeometry'de birleştirir (üç.js sürümünden bağımsız). */
  private mergeBoxes(
    boxes: Array<{ w: number; h: number; d: number; x: number; y: number; z: number }>
  ): THREE.BufferGeometry {
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
      }
      for (let i = 0; i < ix.count; i++) indices.push(ix.getX(i) + offset);
      offset += p.count;
      g.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.setIndex(indices);
    return merged;
  }

  /** Paylaşılan palet geometri/materyallerini serbest bırakır (bileşen yok edilirken). */
  private disposeSharedPalletResources(): void {
    this.palletGeometryCache.forEach(e => {
      e.light.dispose();
      e.dark.dispose();
    });
    this.palletGeometryCache.clear();
    this.sharedPalletMaterials?.light.dispose();
    this.sharedPalletMaterials?.dark.dispose();
    this.sharedPalletMaterials = null;
  }

  // ========================================
  // MOUSE EVENTS
  // ========================================

  private setupMouseEvents(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: false });
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: false });
    canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('click', this.handleMouseClick.bind(this), { passive: false });

    // mouseup ve touchend'i document üzerinde dinle
    // böylece canvas dışında bırakılsa da yakalanır
    // NOT: removeEventListener için AYNI fonksiyon referansı şart; `.bind(this)`
    // her çağrıda yeni fonksiyon ürettiği için eskiden ngOnDestroy'da hiçbir
    // dinleyici kaldırılmıyordu (bileşen her yeniden oluştuğunda document'a
    // bir kat daha dinleyici birikiyordu). Referanslar alan olarak tutuluyor.
    document.addEventListener('mouseup', this.onDocMouseUp);
    document.addEventListener('touchstart', this.onDocTouchStart, { passive: false });
    document.addEventListener('touchmove', this.onDocTouchMove, { passive: false });
    document.addEventListener('touchend', this.onDocTouchEnd, { passive: false });
    document.addEventListener('touchcancel', this.onDocTouchEnd, { passive: false });
  }

  private readonly onDocMouseUp = (e: MouseEvent) => this.handleMouseUp(e);
  private readonly onDocTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
  private readonly onDocTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
  private readonly onDocTouchEnd = (e: TouchEvent) => this.handleTouchEnd(e);
  private readonly onDocFullscreenChange = () => this.handleFullscreenChange();

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

      const intersected = this.getIntersectedAny();
      if (intersected && this.dragModeEnabled && this.hasChangePerm()) {
        this.isTouchDragging = true;
        this.initiateDragging(intersected.pkg, intersected.isPlate);
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
        const intersected = this.getIntersectedAny();
        if (intersected?.isPlate) {
          this.selectPlatePackage(intersected.pkg.pkgId);
        } else if (intersected) {
          this.selectPackage(intersected.pkg.pkgId);
        } else {
          this.clearSelection();
          this.clearPlateSelection();
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
      // Left click - package drag (tır veya plate)
      const intersected = this.getIntersectedAny();
      const additive = event.ctrlKey || event.metaKey;

      if (additive) {
        // Ctrl+tık: seçime ekle/çıkar (handleMouseClick'te); boş alanda Ctrl+sürükle:
        // mevcut seçime kutu seçimi ekler. Ctrl basılıyken paket sürüklenmez.
        if (!intersected) this.startBoxSelection(event, true);
        return;
      }

      if (!intersected) {
        // Boş alanda sol tık + sürükle: kutu seçimi (kamera sadece sağ/orta tıkla döner/kayar)
        this.startBoxSelection(event, false);
        return;
      }

      if (this.dragModeEnabled && this.hasChangePerm()) {
        const id = intersected.pkg.pkgId;
        const multi = Array.from(this.multiSet);
        const groupNo = this.groupOf(id);
        if (multi.length > 1 && this.multiSet.has(id)) {
          this.initiateGroupDragging(multi);
        } else if (groupNo) {
          this.initiateGroupDragging(this.groupsSignal()[groupNo]);
        } else {
          this.initiateDragging(intersected.pkg, intersected.isPlate);
        }
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

    if (this.groupDrag) {
      this.updateGroupDrag();
      this.renderManager.requestRender();
    } else if (this.isBoxSelecting) {
      this.updateBoxSelection(event);
    } else if (this.isDragging && this.draggedPackage) {
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

    if (this.groupDrag) {
      this.completeGroupDrag();
    }

    if (this.isBoxSelecting) {
      this.finishBoxSelection();
    }

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
    if (this.isDragging || this.groupDrag || this.isRotatingCamera || this.mouseMoved) return;

    // 'click' olayı + mouseup'taki gecikmeli çağrı aynı tıklamayı iki kez getirir;
    // Ctrl+tık gibi aç/kapa davranışı için tekilleştir.
    const now = Date.now();
    if (now - this.lastClickHandledAt < 80) return;
    this.lastClickHandledAt = now;

    event.preventDefault();
    this.updateMouseCoordinates(event);

    const intersected = this.getIntersectedAny();

    // Ctrl+tık: çoklu seçime ekle/çıkar (gruplu pakette grubun tamamı)
    if (event.ctrlKey || event.metaKey) {
      if (intersected) this.ctrlToggle(intersected.pkg.pkgId);
      return;
    }

    if (intersected) {
      const groupNo = this.groupOf(intersected.pkg.pkgId);
      if (groupNo) {
        // Gruplu pakete tıklamak grubun tamamını seçer (kilitli blok)
        this.setMultiSelection(this.groupsSignal()[groupNo]);
        return;
      }
    }

    if (intersected?.isPlate) {
      this.selectPlatePackage(intersected.pkg.pkgId);
    } else if (intersected) {
      this.selectPackage(intersected.pkg.pkgId);
    } else {
      this.clearSelection();
      this.clearPlateSelection();
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
    const delta = event.deltaY > 0 ? -1 : 1;
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
    this.renderer.domElement.style.cursor = 'default';
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
    this.renderer.domElement.style.cursor = 'default';
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

  private initiateDragging(packageData: PackageData, fromPlate = false): void {
    this.isDragging = true;
    this.draggedPackage = packageData;
    this.draggedFromPlate = fromPlate;
    packageData.isBeingDragged = true;

    // Başlangıç pozisyonunu kaydet
    this.dragStartPosition = { x: packageData.x, y: packageData.y, z: packageData.z };

    // Plate'ten sürükleniyorsa mesh'i geçici olarak packagesGroup'a al.
    // Sürükleme matematiği (bkz. updateDraggedPackageWithSnapping) X/Z için
    // "local mesh.position ≈ world position" varsayımıyla çalışıyor — bu
    // SADECE packagesGroup için doğru (X/Z offset'i sıfır, sadece Y'de
    // 1100 offset var). plateGroup'un ise Z'de gerçek bir offset'i var
    // (bkz. positionPlateGroup), o yüzden reparent etmeden sürüklersek
    // paket yanlış konumdan "fırlar".
    if (fromPlate && packageData.mesh && packageData.mesh.parent === this.plateGroup) {
      const worldPos = new THREE.Vector3();
      packageData.mesh.getWorldPosition(worldPos);
      this.plateGroup.remove(packageData.mesh);
      this.packagesGroup.add(packageData.mesh);
      packageData.mesh.position.set(
        worldPos.x,
        worldPos.y - this.packagesGroup.position.y,
        worldPos.z
      );
    }

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

      // Plate (bekleme alanı) bölgesinin dünya-Z sınırı — tır genişliğinin
      // ötesinde, en son hesaplanan plate derinliğine kadar. Paket bu
      // bölgeye sürüklenebilsin diye Z ekseni artık SADECE tır sınırında
      // değil, plate'in bittiği yerde clamp ediliyor.
      const plateZEnd = truckDims[1] + this.PLATE_GAP + Math.max(this.plateDepthCurrent, this.PLATE_MIN_DEPTH);

      // Truck sınırları (X hep tırla sınırlı — plate de aynı X aralığında)
      smoothPosition.x = Math.max(
        pkg.length / 2,
        Math.min(truckDims[0] - pkg.length / 2, smoothPosition.x)
      );
      smoothPosition.z = Math.max(
        pkg.width / 2,
        Math.min(plateZEnd - pkg.width / 2, smoothPosition.z)
      );

      // world Z, tır genişliğini aştıysa artık plate bölgesindeyiz —
      // burada tır paketleriyle çakışma/kayma (sliding) mantığı ANLAMSIZ,
      // paket serbestçe taşınabilsin (plate zaten sadece bir bekleme rafı,
      // bırakıldığında grid'e otomatik oturtuluyor — bkz. completeDragging).
      const isOverPlate = smoothPosition.z > truckDims[1];

      const snappedPosition = isOverPlate
        ? smoothPosition
        : this.snapToNearbyPackages(pkg, smoothPosition);

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
        // Her ekseni bağımsız kontrol et — plate bölgesindeyken ATLA
        // ========================================

        let finalX = desiredPos.x;
        let finalY = desiredPos.y;
        // Yükseklik de tır içinde kalsın (zorla yerleştirilmiş paketlerde
        // çakışma kontrolü kapalı olduğu için başka bir sınır yok).
        let finalZ = Math.max(0, Math.min(desiredPos.z, Math.max(0, truckDims[2] - pkg.height)));
        let isSliding = false;

        if (!isOverPlate) {
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
        this.skipStoreSync = true;
        this.orderResultChange();
        this.cdr.markForCheck();
      }
    }
  }

  private completeDragging(): void {
    if (!this.isDragging || !this.draggedPackage) return;

    const pkg = this.draggedPackage;
    const startPos = this.dragStartPosition;
    const wasFromPlate = this.draggedFromPlate;
    const truckDims = this.truckDimension();
    // pkg.y = (world Z) - width/2 (bkz. updateDraggedPackageWithSnapping) —
    // bunu tekrar world Z'ye çevirip tır genişliğiyle kıyaslayarak paketin
    // sürükleme sonunda plate bölgesinde mi kaldığını anlıyoruz.
    const endsOverPlate = (pkg.y + pkg.width / 2) > truckDims[1];

    // Pozisyon gerçekten değişti mi?
    const positionChanged = !!startPos && (
      pkg.x !== startPos.x ||
      pkg.y !== startPos.y ||
      pkg.z !== startPos.z
    );

    this.saveSnapshot();

    if (pkg.mesh) {
      const material = pkg.mesh.material as THREE.MeshStandardMaterial;
      material.wireframe = this.wireframeMode;
      material.emissive.setHex(0x000000);
    }

    pkg.isBeingDragged = false;
    this.isDragging = false;
    this.draggedPackage = null;
    this.dragStartPosition = null;
    this.draggedFromPlate = false;
    this.renderer.domElement.style.cursor = 'default';
    this.clearHighlights();
    this.skipStoreSync = false;

    if (wasFromPlate && !positionChanged) {
      // Sadece tıklandı — hiç gerçek sürükleme olmadı. initiateDragging YİNE
      // DE mesh'i mousedown anında geçici olarak packagesGroup'a almıştı
      // (bkz. initiateDragging) — burada mesh'i DISPOSE EDİP YENİDEN
      // KURMAK YERİNE ucuz bir şekilde plateGroup'a GERİ TAŞIYORUZ (dünya
      // konumunu koruyarak). Önceden her tıklamada tam bir dispose+rebuild
      // (CanvasTexture etiketleri dahil) yapılıyordu — bu hem gereksiz
      // pahalıydı hem de plate ring'in bir an için yanlış/eski konumda
      // görünüp sonra pakete "atlaması" hissi veriyordu.
      this.revertPlateMeshReparent(pkg);
      this.renderManager.requestRender();
      return;
    }

    if (wasFromPlate && endsOverPlate) {
      // Plate sınırları içinde GERÇEKTEN taşındı. Sürükleme SIRASINDA
      // çakışma kontrolü yapılmıyor (serbestçe gezinebilsin diye), ama
      // BIRAKMA ANINDA tek seferlik bir kontrol yapıyoruz: bırakılan yer
      // müsaitse orada kalır, değilse en yakın müsait boşluğa oturtulur.
      const plateOffsetZ = truckDims[1] + this.PLATE_GAP;
      const desiredX = pkg.x;
      const desiredZ = pkg.y - plateOffsetZ;
      const others = this.packagesStateService.deletedPackages()
        .filter(p => p.pkgId !== pkg.pkgId && p.x >= 0 && p.y >= 0);
      const spot = this.findNearestFreePlateSpot(pkg, desiredX, desiredZ, others);
      pkg.x = spot.x;
      pkg.y = spot.z;
      pkg.z = 0;
      // Konum gerçekten değiştiği için burada tam yeniden kurulum (yeni
      // slot'a göre) gerekiyor — bkz. refreshSinglePlatePackageMesh.
      this.refreshSinglePlatePackageMesh(pkg);
      this.renderManager.requestRender();
      return;
    }

    if (wasFromPlate && !endsOverPlate) {
      // Plate'ten tıra sürüklendi → yerleştirme akışı (bkz. finalizeDragFromPlate)
      this.finalizeDragFromPlate(pkg);
      this.renderManager.requestRender();
      return;
    }

    if (!wasFromPlate && endsOverPlate) {
      // Tırdan plate'e sürüklendi → sil akışı (bkz. finalizeDragToPlate)
      this.finalizeDragToPlate(pkg);
      this.renderManager.requestRender();
      return;
    }

    // Tırda kaldı — mevcut davranış (değişmedi)
    if (this.selectedPackageSignal()) {
      this.highlightSelectedPackage();
    }

    if (positionChanged) {
      this.orderResultChange();
      this.applyGravityToAllPackages();
    }

    this.renderManager.requestRender();
  }

  /**
   * Tırdan plate'e sürüklenerek bırakılan bir paketi kalıcı olarak
   * "yerleşmeyen" listesine taşır — deleteSelectedPackage() ile AYNI store
   * akışı, sadece seçili paket yerine sürüklenen paketi (pkg) hedefler.
   */
  private finalizeDragToPlate(pkg: PackageData): void {
    this.isLocalOperation = true;

    // Paket henüz packagesGroup'ta (world==local, X/Z offset 0) — mesh'i
    // dispose etmeden ÖNCE bırakıldığı gerçek dünya konumunu plate-local'e
    // çevirip, plate'teki diğer paketlerle SADECE bu anlık kontrolde
    // çakışıp çakışmadığına bakıyoruz (sürükleme sırasında hiç kontrol
    // yapılmıyordu — kullanıcı isteği: bırakınca hızlıca kontrol edip
    // müsait en yakın boşluğa otursun).
    const truckDims = this.truckDimension();
    const plateOffsetZ = truckDims[1] + this.PLATE_GAP;
    const desiredX = pkg.x;
    const desiredZ = pkg.y - plateOffsetZ;
    const others = this.packagesStateService.deletedPackages()
      .filter(p => p.x >= 0 && p.y >= 0);
    const spot = this.findNearestFreePlateSpot(pkg, desiredX, desiredZ, others);

    // Eski tır mesh'ini temizle — plate rebuild'i (reaktif
    // plateVisualizationSyncEffect) YENİ bir mesh oluşturacak; eskisini
    // burada dispose etmezsek packagesGroup altında sızıntı + hayalet mesh
    // olarak kalır.
    if (pkg.mesh) {
      this.packagesGroup.remove(pkg.mesh);
      this.disposeObjectTree(pkg.mesh);
      pkg.mesh = undefined;
    }
    pkg.forcePlaceBorder = undefined;

    // Bırakıldığı (veya çakışıyorsa en yakın müsait) plate-local konumu
    // kalıcı olarak yaz — computePlateLayout artık bunu (x/y >= 0 olduğu
    // için) KORUYACAK, yeniden grid'e dizmeyecek.
    pkg.x = spot.x;
    pkg.y = spot.z;
    pkg.z = 0;

    if (this.selectedPackageSignal()?.pkgId === pkg.pkgId) {
      this.packagesStateService.clearSelection();
    }

    this.packagesStateService.moveToDeleted(pkg.pkgId);
    this.applyGravityToAllPackages();

    this.store.dispatch(StepperResultActions.removePackageFromTruck({ pkgId: pkg.pkgId }));
    const row: PackagePosition = [
      -1, -1, -1,
      pkg.length, pkg.width, pkg.height,
      pkg.id, pkg.weight, pkg.pkgId
    ];
    this.store.dispatch(StepperResultActions.addDeletedPackage({ row }));

    this.orderResultChange();
  }

  /**
   * Plate'ten tıra sürüklenerek bırakılan bir paketi kalıcı olarak tıra
   * yerleştirir — restorePackage() 'un tersine, findValidPosition ile
   * otomatik yer ARAMAZ; kullanıcının sürükleyip bıraktığı GERÇEK konumu
   * (pkg.x/y/z, sürükleme boyunca zaten collision-free tutuldu — bkz.
   * updateDraggedPackageWithSnapping) kullanır. Mesh zaten initiateDragging
   * sırasında packagesGroup'a reparent edilip doğru konuma taşınmıştı,
   * burada yeniden oluşturmuyoruz.
   */
  private finalizeDragFromPlate(pkg: PackageData): void {
    this.isLocalOperation = true;

    this.packagesStateService.removeFromDeletedPackages(pkg.pkgId);
    // addToProcessedPackages → onPackageAddedCallback zaten pkg.mesh mevcut
    // olduğu için yeni bir mesh OLUŞTURMAYACAK (bkz. ngOnInit'teki callback),
    // mevcut (doğru konumdaki) mesh'i korur.
    this.packagesStateService.addToProcessedPackages(pkg);

    const position: PackagePosition = [
      pkg.x, pkg.y, pkg.z,
      pkg.length, pkg.width, pkg.height,
      pkg.id, pkg.weight, pkg.pkgId
    ];
    this.store.dispatch(StepperResultActions.addPackageToTruck({ position }));
    this.store.dispatch(StepperResultActions.removeDeletedPackage({ pkgId: pkg.pkgId }));

    this.orderResultChange();
    this.applyGravityToAllPackages();
  }

  private cancelDragging(): void {
    const pkg = this.draggedPackage;
    if (pkg) {
      pkg.isBeingDragged = false;

      // Plate'ten alınmış bir paketin sürüklemesi iptal edildiyse (ör. 2.
      // parmak devreye girdi) — initiateDragging'in geçici olarak
      // packagesGroup'a aldığı mesh'i ucuza (dispose+rebuild YAPMADAN,
      // dünya konumunu koruyarak) plate'e geri taşı — bkz.
      // revertPlateMeshReparent.
      if (this.draggedFromPlate) {
        this.revertPlateMeshReparent(pkg);
        this.renderManager.requestRender();
      }
    }
    this.isDragging = false;
    this.draggedPackage = null;
    this.draggedFromPlate = false;
    this.renderer.domElement.style.cursor = 'default';
  }

  // ========================================
  // ÇOKLU SEÇİM / GRUPLAR / TOPLU TAŞIMA
  // ========================================
  //
  // - Seçim: Ctrl+tık (ekle/çıkar), boş alanda sol tık sürükle (kutu seçimi).
  //   Seçim NgRx store'da (store/package-groups) tutulur; `multiSet` yerel aynasıdır.
  // - Gruplar (Shift+1..9): gruplu paketler kilitli bir blok gibi taşınır/silinir.
  // - Toplu taşıma: göreli konumlar (x/y/z) korunur; bırakmada TÜM üyeler birlikte
  //   doğrulanır — biri bile sığmıyorsa hepsi eski yerine döner.
  // - Çoklu seçimde halka/döndürme yok; sadece taşıma ve "sil" (= plate'e al).

  private lastClickHandledAt = 0;

  private groupOf(pkgId: string): string | null {
    for (const [no, ids] of Object.entries(this.groupsSignal())) {
      if (ids.includes(pkgId)) return no;
    }
    return null;
  }

  private expandWithGroups(ids: string[]): string[] {
    const groups = this.groupsSignal();
    const out = new Set(ids);
    for (const id of ids) {
      const no = this.groupOf(id);
      if (no) groups[no].forEach(m => out.add(m));
    }
    return Array.from(out);
  }

  private findAnyPackage(pkgId: string): { pkg: PackageData; isPlate: boolean } | null {
    const onTruck = this.packagesStateService.getProcessedPackageById(pkgId);
    if (onTruck) return { pkg: onTruck, isPlate: false };
    const onPlate = this.packagesStateService.getDeletedPackageById(pkgId);
    return onPlate ? { pkg: onPlate, isPlate: true } : null;
  }

  private currentSingleIds(): Set<string> {
    const s = new Set<string>();
    const a = this.selectedPackageSignal();
    if (a) s.add(a.pkgId);
    const b = this.selectedPlatePackageSignal();
    if (b) s.add(b.pkgId);
    return s;
  }

  private selectAny(pkgId: string): void {
    const f = this.findAnyPackage(pkgId);
    if (!f) return;
    if (f.isPlate) this.selectPlatePackage(pkgId);
    else this.selectPackage(pkgId);
  }

  private setMultiSelection(ids: string[]): void {
    const unique = Array.from(new Set(ids)).filter(id => !!this.findAnyPackage(id));
    if (unique.length < 2) {
      this.clearMultiSelection();
      if (unique.length === 1) this.selectAny(unique[0]);
      else this.clearSelection();
      return;
    }
    // Tekli seçimi temizle (halka da kapanır)
    this.packagesStateService.clearSelection();
    this.clearPlateSelection();
    this.multiSet = new Set(unique);
    this.store.dispatch(PackageGroupsActions.setMultiSelection({ ids: unique }));
    this.clearHighlights();
    this.renderManager.requestRender();
    this.cdr.markForCheck();
  }

  private clearMultiSelection(): void {
    if (this.multiSet.size === 0) return;
    this.multiSet = new Set();
    this.store.dispatch(PackageGroupsActions.clearMultiSelection());
    this.clearHighlights();
    this.renderManager.requestRender();
  }

  private ctrlToggle(pkgId: string): void {
    const base = this.multiSet.size > 0 ? new Set(this.multiSet) : this.currentSingleIds();
    const clicked = this.expandWithGroups([pkgId]);
    const allIn = clicked.every(id => base.has(id));
    clicked.forEach(id => (allIn ? base.delete(id) : base.add(id)));
    this.setMultiSelection(Array.from(base));
  }

  /** Çoklu seçimdeki paketlerin vurgusunu (emissive) yeniden uygular. */
  private reapplyMultiEmissive(): void {
    this.multiSet.forEach(id => {
      const f = this.findAnyPackage(id);
      if (f?.pkg.mesh && !f.pkg.isBeingDragged) {
        (f.pkg.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x666666);
      }
    });
  }

  // ---------- Kutu seçimi ----------

  private startBoxSelection(event: MouseEvent, additive: boolean): void {
    const rect = (this.threeContainer.nativeElement as HTMLElement).getBoundingClientRect();
    this.isBoxSelecting = true;
    this.boxAdditive = additive;
    this.boxMoved = false;
    this.boxOrigin = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private updateBoxSelection(event: MouseEvent): void {
    const rect = (this.threeContainer.nativeElement as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const width = Math.abs(x - this.boxOrigin.x);
    const height = Math.abs(y - this.boxOrigin.y);
    if (width > 4 || height > 4) {
      this.boxMoved = true;
      this.selectionBox.set({
        left: Math.min(x, this.boxOrigin.x),
        top: Math.min(y, this.boxOrigin.y),
        width,
        height,
      });
    }
  }

  private finishBoxSelection(): void {
    const box = this.selectionBox();
    const additive = this.boxAdditive;
    const moved = this.boxMoved;
    this.isBoxSelecting = false;
    this.boxMoved = false;
    this.selectionBox.set(null);
    if (!box || !moved || !this.camera) return;

    const container = this.threeContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.packagesGroup.updateMatrixWorld(true);
    this.plateGroup?.updateMatrixWorld(true);

    const hit: string[] = [];
    const v = new THREE.Vector3();
    const test = (pkg: PackageData) => {
      if (!pkg.mesh) return;
      pkg.mesh.getWorldPosition(v);
      v.project(this.camera);
      if (v.z > 1) return;
      const sx = (v.x * 0.5 + 0.5) * width;
      const sy = (-v.y * 0.5 + 0.5) * height;
      if (sx >= box.left && sx <= box.left + box.width && sy >= box.top && sy <= box.top + box.height) {
        hit.push(pkg.pkgId);
      }
    };
    this.processedPackagesSignal().forEach(test);
    this.packagesStateService.deletedPackages().forEach(test);

    let ids = this.expandWithGroups(hit);
    if (additive) {
      const base = this.multiSet.size > 0 ? this.multiSet : this.currentSingleIds();
      ids = Array.from(new Set([...base, ...ids]));
    }
    if (ids.length === 0) {
      if (!additive) this.clearSelection();
      return;
    }
    this.setMultiSelection(ids);
  }

  // ---------- Grup tanımlama ----------

  /** Çoklu seçimi `no` numaralı gruba atar (Shift+rakam). */
  assignGroup(no: number | string): void {
    if (!this.hasChangePerm()) return;
    const ids = Array.from(this.multiSet);
    if (ids.length < 2) {
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.GROUP_NEED_SELECTION'));
      return;
    }
    const locations = new Set(ids.map(id => !!this.packagesStateService.getDeletedPackageById(id)));
    if (locations.size > 1) {
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.GROUP_MIXED_LOCATION'));
      return;
    }
    const existing = this.groupsSignal()[String(no)];
    if (existing) {
      const selected = new Set(ids);
      const same = existing.length === selected.size && existing.every(id => selected.has(id));
      if (!same) {
        // Numara başka bir grupta kullanılıyor: sessizce bozup yenisini kurma, uyar.
        this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.GROUP_NUMBER_TAKEN', { no }));
      }
      return;
    }
    this.store.dispatch(PackageGroupsActions.assignGroup({ no: this.groupKey(no), ids }));
    this.toastService.success(this.translate.instant('TRUCK_VISUALIZATION.GROUP_CREATED', { no }));
  }

  /** Seçimdeki paketleri içeren tüm grupları bozar (paketler yerinde kalır). */
  dissolveSelectedGroups(): void {
    const ids = this.multiSet;
    const nos = Object.entries(this.groupsSignal())
      .filter(([, members]) => members.some(id => ids.has(id)))
      .map(([no]) => no);
    nos.forEach(no => this.store.dispatch(PackageGroupsActions.dissolveGroup({ no: this.groupKey(no) })));
    if (nos.length) {
      this.toastService.info(this.translate.instant('TRUCK_VISUALIZATION.GROUP_DISSOLVED'));
    }
  }

  private selectGroupByNo(no: string): void {
    const members = this.groupsSignal()[no];
    if (!members) return;
    this.setMultiSelection(members);
  }

  /** Grup(lar)ı dağıtır — otomatik yerleştirme sonrası kullanılır. */
  private clearAllGroups(notify: boolean, allShipments = false): void {
    const current = Object.keys(this.groupsSignal());
    const had = allShipments ? Object.keys(this.rawGroupsSignal()).length > 0 : current.length > 0;
    if (!had) return;
    if (allShipments) {
      this.store.dispatch(PackageGroupsActions.clearGroups());
    } else {
      current.forEach(no => this.store.dispatch(PackageGroupsActions.dissolveGroup({ no: this.groupKey(no) })));
    }
    if (notify) this.toastService.info(this.translate.instant('TRUCK_VISUALIZATION.GROUPS_CLEARED'));
  }

  // ---------- Toplu silme (plate'e alma) ----------

  deleteMultiSelection(): void {
    if (!this.hasChangePerm()) return;
    const members = Array.from(this.multiSet)
      .map(id => this.packagesStateService.getProcessedPackageById(id))
      .filter((p): p is PackageData => !!p);
    if (members.length === 0) {
      this.toastService.info(this.translate.instant('TRUCK_VISUALIZATION.MULTI_ONLY_UNPLACED'));
      return;
    }

    const entries = members.map(m => ({ m, px: m.x, py: m.y, pz: m.z }));
    const z0 = Math.min(...entries.map(e => e.pz));
    entries.forEach(e => (e.pz -= z0));
    const shift = this.findFreePlateGroupShift(entries, new Set(members.map(m => m.pkgId)));

    this.saveSnapshot();
    this.isLocalOperation = true;
    this.moveEntriesToPlate(entries, shift);
    this.clearMultiSelection();
    this.orderResultChange();
    this.applyGravityToAllPackages();
  }

  /** Tırdaki paketleri (konumlar entries'te) plate'e koyar ve store'u günceller. */
  private moveEntriesToPlate(
    entries: { m: PackageData; px: number; py: number; pz: number }[],
    shift: { sx: number; sy: number }
  ): void {
    entries.forEach(e => {
      e.m.x = Math.round(e.px + shift.sx);
      e.m.y = Math.round(e.py + shift.sy);
      e.m.z = 0;
      e.m.plateZ = e.pz > 0 ? e.pz : undefined;
    });
    entries.forEach(e => {
      const m = e.m;
      this.packagesStateService.moveToDeleted(m.pkgId);
      this.store.dispatch(StepperResultActions.removePackageFromTruck({ pkgId: m.pkgId }));
      const row: PackagePosition = [-1, -1, -1, m.length, m.width, m.height, m.id, m.weight, m.pkgId];
      this.store.dispatch(StepperResultActions.addDeletedPackage({ row }));
    });
  }

  /**
   * Plate'te (2B ayak izi) çakışmayan, istenen yere en yakın grup kaydırmasını bulur.
   * entries: üyelerin plate-yerel konumları (px,py) ve grup içi göreli yüksekliği (pz).
   */
  private findFreePlateGroupShift(
    entries: { m: PackageData; px: number; py: number; pz: number }[],
    memberIds: Set<string>
  ): { sx: number; sy: number } {
    const truckDims = this.truckDimension();
    const plateWidth = Math.max(truckDims[0], 1000);
    const others = this.packagesStateService.deletedPackages()
      .filter(p => !memberIds.has(p.pkgId) && p.x >= 0 && p.y >= 0);

    const minPx = Math.min(...entries.map(e => e.px));
    const maxPx = Math.max(...entries.map(e => e.px + e.m.length));
    const minPy = Math.min(...entries.map(e => e.py));

    // Sınırlar: x plate genişliği içinde, y >= 0
    let sx0 = 0;
    if (minPx < 0) sx0 = -minPx;
    if (maxPx + sx0 > plateWidth) sx0 = plateWidth - maxPx;
    const sy0 = Math.max(0, -minPy);

    const free = (sx: number, sy: number): boolean => {
      for (const e of entries) {
        const x = e.px + sx;
        const y = e.py + sy;
        if (x < -0.5 || x + e.m.length > plateWidth + 0.5 || y < -0.5) return false;
        for (const o of others) {
          if (x < o.x + o.length && x + e.m.length > o.x && y < o.y + o.width && y + e.m.width > o.y) {
            return false;
          }
        }
      }
      return true;
    };

    if (free(sx0, sy0)) return { sx: sx0, sy: sy0 };

    const step = 80;
    const maxRadius = 5000;
    for (let r = step; r <= maxRadius; r += step) {
      const candidates: Array<{ sx: number; sy: number }> = [];
      for (let d = -r; d <= r; d += step) {
        candidates.push({ sx: sx0 + d, sy: sy0 - r }, { sx: sx0 + d, sy: sy0 + r });
      }
      for (let d = -r + step; d <= r - step; d += step) {
        candidates.push({ sx: sx0 - r, sy: sy0 + d }, { sx: sx0 + r, sy: sy0 + d });
      }
      candidates.sort((a, b) =>
        (Math.abs(a.sx - sx0) + Math.abs(a.sy - sy0)) - (Math.abs(b.sx - sx0) + Math.abs(b.sy - sy0))
      );
      for (const c of candidates) {
        if (free(c.sx, c.sy)) return c;
      }
    }

    // Hiç boşluk yok: tüm plate paketlerinin altına
    const bottom = others.reduce((mx, o) => Math.max(mx, o.y + o.width), 0) + this.PLATE_ITEM_GAP;
    return { sx: sx0, sy: Math.max(sy0, bottom - minPy) };
  }

  // ---------- Toplu sürükleme ----------

  private initiateGroupDragging(ids: string[]): void {
    const found = ids
      .map(id => this.findAnyPackage(id))
      .filter((f): f is { pkg: PackageData; isPlate: boolean } => !!f && !!f.pkg.mesh);
    if (found.length < 2) return;

    if (new Set(found.map(f => f.isPlate)).size > 1) {
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.GROUP_MIXED_LOCATION'));
      return;
    }
    const fromPlate = found[0].isPlate;
    const offY = fromPlate ? this.truckDimension()[1] + this.PLATE_GAP : 0;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const pointer = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, pointer)) return;

    const members = found.map(f => f.pkg);
    const start = new Map<string, { x: number; y: number; lz: number }>();
    const startMesh = new Map<string, THREE.Vector3>();
    members.forEach(m => {
      start.set(m.pkgId, { x: m.x, y: m.y + offY, lz: fromPlate ? (m.plateZ ?? 0) : m.z });
      startMesh.set(m.pkgId, m.mesh!.position.clone());
    });

    this.groupDrag = {
      members,
      fromPlate,
      start,
      startMesh,
      startPointer: pointer,
      bbox: {
        minX: Math.min(...members.map(m => start.get(m.pkgId)!.x)),
        maxX: Math.max(...members.map(m => start.get(m.pkgId)!.x + m.length)),
        minY: Math.min(...members.map(m => start.get(m.pkgId)!.y)),
        maxY: Math.max(...members.map(m => start.get(m.pkgId)!.y + m.width)),
      },
      moved: false,
      dx: 0,
      dy: 0,
      overPlate: fromPlate,
      valid: true,
    };
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  private updateGroupDrag(): void {
    const gd = this.groupDrag;
    if (!gd) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const pt = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, pt)) return;

    let dx = pt.x - gd.startPointer.x;
    let dy = pt.z - gd.startPointer.z;
    if (!gd.moved) {
      if (Math.hypot(dx, dy) < 15) return; // tıklama ile sürüklemeyi ayır
      gd.moved = true;
      gd.members.forEach(m => {
        const mat = m.mesh!.material as THREE.MeshStandardMaterial;
        mat.wireframe = true;
      });
    }

    const truck = this.truckDimension();
    const plateZEnd = truck[1] + this.PLATE_GAP + Math.max(this.plateDepthCurrent, this.PLATE_MIN_DEPTH);
    const b = gd.bbox;
    const rawCenterY = (b.minY + b.maxY) / 2 + dy;
    const overPlate = rawCenterY > truck[1];

    // Dünya sınırları (X hep tır boyu; Y tır + plate bölgesi)
    dx = Math.max(-b.minX, Math.min(truck[0] - b.maxX, dx));
    dy = Math.max(-b.minY, Math.min(plateZEnd - b.maxY, dy));
    if (!overPlate) {
      // Tır bölgesinde grup tır içinde kalsın (sığıyorsa)
      if (b.maxY - b.minY <= truck[1]) dy = Math.max(-b.minY, Math.min(truck[1] - b.maxY, dy));
      const snapped = this.snapGroupDelta(gd, dx, dy);
      dx = snapped.dx;
      dy = snapped.dy;
    }

    gd.dx = dx;
    gd.dy = dy;
    gd.overPlate = overPlate;

    gd.members.forEach(m => {
      const s = gd.startMesh.get(m.pkgId)!;
      m.mesh!.position.x = s.x + dx;
      m.mesh!.position.z = s.z + dy;
    });

    gd.valid = overPlate ? true : this.resolveTruckDrop(gd, dx, dy) !== null;
    gd.members.forEach(m => {
      const mat = m.mesh!.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(gd.valid ? 0x888888 : 0xff0000);
    });
    if (gd.valid) this.clearCollisionWarning();
    else this.showCollisionWarningBriefly();
  }

  /** Grup sınırlarını tır duvarlarına / diğer paketlerin kenarlarına 50 mm içinde yapıştırır. */
  private snapGroupDelta(
    gd: GroupDragState,
    dx: number,
    dy: number
  ): { dx: number; dy: number } {
    const T = 50;
    const truck = this.truckDimension();
    const memberIds = new Set(gd.members.map(m => m.pkgId));
    const xs: number[] = [0, truck[0]];
    const ys: number[] = [0, truck[1]];
    this.processedPackagesSignal().forEach(p => {
      if (memberIds.has(p.pkgId)) return;
      xs.push(p.x, p.x + p.length);
      ys.push(p.y, p.y + p.width);
    });
    const b = gd.bbox;
    const pick = (edges: number[], lo: number, hi: number): number => {
      let best = 0;
      let bestAbs = Infinity;
      for (const e of edges) {
        for (const m of [lo, hi]) {
          const d = e - m;
          if (Math.abs(d) <= T && Math.abs(d) < bestAbs) {
            best = d;
            bestAbs = Math.abs(d);
          }
        }
      }
      return best;
    };
    return {
      dx: dx + pick(xs, b.minX + dx, b.maxX + dx),
      dy: dy + pick(ys, b.minY + dy, b.maxY + dy),
    };
  }

  /**
   * Grubu (dx,dy) kadar kaydırınca tırda geçerli bir yere oturup oturmadığını çözer.
   * Geçerliyse dikey kayma (shift: zemine/alttaki pakete oturtma) döner, değilse null.
   * Üyelerin birbirine göre x/y/z konumu DEĞİŞMEZ; sadece grup bir bütün olarak yükselir/iner.
   */
  private resolveTruckDrop(
    gd: GroupDragState,
    dx: number,
    dy: number
  ): { shift: number } | null {
    const truck = this.truckDimension();
    const memberIds = new Set(gd.members.map(m => m.pkgId));
    const others = this.processedPackagesSignal().filter(p => !memberIds.has(p.pkgId));
    const pos = gd.members.map(m => {
      const s = gd.start.get(m.pkgId)!;
      return { m, x: s.x + dx, y: s.y + dy, lz: s.lz };
    });

    for (const p of pos) {
      if (p.m.isForcePlaced) continue;
      if (p.x < -0.5 || p.y < -0.5 ||
        p.x + p.m.length > truck[0] + 0.5 || p.y + p.m.width > truck[1] + 0.5) return null;
    }

    const z0 = Math.min(...pos.map(p => p.lz));
    const floors = new Set<number>([0]);
    for (const o of others) {
      const overlapsGroup = pos.some(p =>
        p.x < o.x + o.length && p.x + p.m.length > o.x &&
        p.y < o.y + o.width && p.y + p.m.width > o.y);
      if (overlapsGroup) floors.add(o.z + o.height);
    }

    for (const f of Array.from(floors).sort((a, b) => a - b)) {
      const shift = f - z0;
      const ok = pos.every(p => {
        const z = p.lz + shift;
        if (z < -0.5) return false;
        if (!p.m.isForcePlaced && z + p.m.height > truck[2] + 0.5) return false;
        return !this.checkCollisionPrecise(p.m, { x: p.x, y: p.y, z }, others);
      });
      if (ok) return { shift };
    }
    return null;
  }

  private restoreGroupMeshes(gd: GroupDragState): void {
    gd.members.forEach(m => {
      const s = gd.startMesh.get(m.pkgId);
      if (m.mesh && s) m.mesh.position.copy(s);
    });
  }

  private resetGroupDragVisuals(gd: GroupDragState): void {
    gd.members.forEach(m => {
      if (!m.mesh) return;
      const mat = m.mesh.material as THREE.MeshStandardMaterial;
      mat.wireframe = this.wireframeMode;
      mat.emissive.setHex(this.multiSet.has(m.pkgId) ? 0x666666 : 0x000000);
    });
  }

  private completeGroupDrag(): void {
    const gd = this.groupDrag;
    if (!gd) return;
    this.groupDrag = null;
    this.renderer.domElement.style.cursor = 'default';
    this.resetGroupDragVisuals(gd);
    this.clearCollisionWarning();
    if (!gd.moved) return; // sadece tıklandı

    if (gd.overPlate) {
      this.dropGroupOnPlate(gd);
    } else {
      this.dropGroupOnTruck(gd);
    }
    this.renderManager.requestRender();
    this.cdr.markForCheck();
  }

  private dropGroupOnTruck(gd: GroupDragState): void {
    const res = this.resolveTruckDrop(gd, gd.dx, gd.dy);
    if (!res) {
      this.restoreGroupMeshes(gd);
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.GROUP_CANNOT_PLACE'));
      return;
    }

    this.saveSnapshot();
    this.isLocalOperation = true;

    gd.members.forEach(m => {
      const s = gd.start.get(m.pkgId)!;
      m.x = Math.round(s.x + gd.dx);
      m.y = Math.round(s.y + gd.dy);
      m.z = Math.max(0, Math.round(s.lz + res.shift));
      m.plateZ = undefined;
    });

    if (!gd.fromPlate) {
      gd.members.forEach(m => {
        m.mesh?.position.set(m.x + m.length / 2, m.z + m.height / 2, m.y + m.width / 2);
      });
    } else {
      // Plate → tır: listeler arası taşı; mesh addToProcessedPackages callback'inde yeniden kurulur.
      gd.members.forEach(m => {
        this.packagesStateService.removeFromDeletedPackages(m.pkgId);
        this.packagesStateService.addToProcessedPackages(m);
        const position: PackagePosition = [m.x, m.y, m.z, m.length, m.width, m.height, m.id, m.weight, m.pkgId];
        this.store.dispatch(StepperResultActions.addPackageToTruck({ position }));
        this.store.dispatch(StepperResultActions.removeDeletedPackage({ pkgId: m.pkgId }));
      });
      this.clearMultiSelection();
    }

    this.orderResultChange();
    this.applyGravityToAllPackages();
  }

  private dropGroupOnPlate(gd: GroupDragState): void {
    const plateOffsetZ = this.truckDimension()[1] + this.PLATE_GAP;
    const entries = gd.members.map(m => {
      const s = gd.start.get(m.pkgId)!;
      return { m, px: s.x + gd.dx, py: s.y + gd.dy - plateOffsetZ, pz: s.lz };
    });
    const z0 = Math.min(...entries.map(e => e.pz));
    entries.forEach(e => (e.pz -= z0));
    const shift = this.findFreePlateGroupShift(entries, new Set(gd.members.map(m => m.pkgId)));

    this.saveSnapshot();
    this.isLocalOperation = true;

    if (gd.fromPlate) {
      entries.forEach(e => {
        e.m.x = Math.round(e.px + shift.sx);
        e.m.y = Math.round(e.py + shift.sy);
        e.m.z = 0;
        e.m.plateZ = e.pz > 0 ? e.pz : undefined;
      });
      entries.forEach(e => this.refreshSinglePlatePackageMesh(e.m));
      this.reapplyMultiEmissive();
    } else {
      this.moveEntriesToPlate(entries, shift);
      this.clearMultiSelection();
      this.orderResultChange();
      this.applyGravityToAllPackages();
    }
  }

  /** Grup rozetlerinin ekran konumunu günceller (overlap rozetleriyle aynı yaklaşım). */
  private updateGroupBadgePositions(): void {
    const layer = this.groupBadgeLayerRef?.nativeElement;
    if (!layer || !this.camera || !this.threeContainer) return;
    const badges = layer.querySelectorAll<HTMLElement>('.tjs-group-badge');
    if (!badges.length) return;

    const container = this.threeContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    this.packagesGroup?.updateMatrixWorld(true);
    this.plateGroup?.updateMatrixWorld(true);

    badges.forEach(el => {
      const f = this.findAnyPackage(el.dataset['pkg'] ?? '');
      if (!f?.pkg.mesh) {
        el.style.display = 'none';
        return;
      }
      f.pkg.mesh.getWorldPosition(this.ringProjectionVector);
      this.ringProjectionVector.y += f.pkg.height / 2 + 20;
      this.ringProjectionVector.project(this.camera);
      if (this.ringProjectionVector.z > 1) {
        el.style.display = 'none';
        return;
      }
      const x = (this.ringProjectionVector.x * 0.5 + 0.5) * width;
      const y = (-this.ringProjectionVector.y * 0.5 + 0.5) * height;
      el.style.display = 'flex';
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });
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

  /**
   * Plate üzerinde bırakılan bir paket için, istenen (desired) konum
   * müsaitse onu, DEĞİLSE (başka bir plate paketiyle çakışıyorsa) en
   * yakın müsait boşluğu döner. Sürükleme SIRASINDA plate'te çakışma
   * kontrolü yapılmıyor (serbestçe gezinebilsin diye) — kontrol SADECE
   * bırakma anında, bir kerelik yapılır (bkz. completeDragging /
   * finalizeDragToPlate). Arama merkezden dışa doğru genişleyen kare
   * halkalar (ring search) şeklinde — bu yüzden bulunan boşluk her zaman
   * bırakılan noktaya en yakın müsait yerdir.
   */
  private findNearestFreePlateSpot(
    pkg: PackageData,
    desiredX: number,
    desiredZ: number,
    others: PackageData[]
  ): { x: number; z: number } {
    const step = 80;
    const maxRadius = 6000;
    const truckDims = this.truckDimension();
    const plateWidth = Math.max(truckDims[0], 1000);

    const clampX = (x: number) => Math.max(0, Math.min(plateWidth - pkg.length, x));
    const clampZ = (z: number) => Math.max(0, z);

    const isFree = (x: number, z: number) =>
      !this.checkCollisionPrecise(pkg, { x, y: z, z: 0 }, others);

    const x0 = clampX(desiredX);
    const z0 = clampZ(desiredZ);
    if (isFree(x0, z0)) return { x: x0, z: z0 };

    for (let r = step; r <= maxRadius; r += step) {
      const candidates: Array<{ x: number; z: number }> = [];
      for (let dx = -r; dx <= r; dx += step) {
        candidates.push({ x: x0 + dx, z: z0 - r });
        candidates.push({ x: x0 + dx, z: z0 + r });
      }
      for (let dz = -r + step; dz <= r - step; dz += step) {
        candidates.push({ x: x0 - r, z: z0 + dz });
        candidates.push({ x: x0 + r, z: z0 + dz });
      }
      candidates.sort((a, b) =>
        (Math.abs(a.x - x0) + Math.abs(a.z - z0)) - (Math.abs(b.x - x0) + Math.abs(b.z - z0))
      );
      for (const c of candidates) {
        const cx = clampX(c.x);
        const cz = clampZ(c.z);
        if (isFree(cx, cz)) return { x: cx, z: cz };
      }
    }

    // Hiç boşluk bulunamadıysa (aşırı kalabalık) — en alta ekle.
    return { x: 0, z: z0 + pkg.width + this.PLATE_ITEM_GAP };
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

  /**
   * getIntersectedPackage'ın plate (bekleme alanı) farkındalıklı hali —
   * hem tır (packagesGroup) hem plate (plateGroup) mesh'lerini tarar ve
   * hangi grupta bulunduğunu (isPlate) da döner. Sadece SEÇİM ve
   * SÜRÜKLEME BAŞLATMA noktalarında kullanılır (handleMouseDown/
   * handleMouseClick/handleTouchStart) — hover efektleri ve diğer TÜM
   * mevcut tır-özel akışlar bilerek eski getIntersectedPackage()'ı
   * kullanmaya devam ediyor (davranış değişikliği riskini sınırlamak için).
   */
  private getIntersectedAny(): { pkg: PackageData; isPlate: boolean } | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = this.plateGroup
      ? [...this.packagesGroup.children, ...this.plateGroup.children]
      : this.packagesGroup.children;
    const intersects = this.raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const pkg = mesh.userData['packageData'] as PackageData | undefined;
      if (!pkg) return null;
      return { pkg, isPlate: !!mesh.userData['isPlatePackage'] };
    }
    return null;
  }

  private selectPackage(pkgId: string): void {
    this.clearMultiSelection();
    this.clearPlateSelection();
    this.clearHighlights();
    this.packagesStateService.selectPackage(pkgId)
    this.highlightSelectedPackage();
    this.renderManager.requestRender();
  }

  clearSelection(): void {
    this.clearMultiSelection();
    this.packagesStateService.clearSelection();
    this.clearHighlights();
    this.clearPlateSelection();
    this.renderManager.requestRender();
  }

  /**
   * Plate'te (bekleme alanı) bir paketi seçer — tır seçiminden (bkz.
   * selectPackage/packagesStateService.selectedPackage) BİLEREK ayrı bir
   * signal üzerinden tutulur: plate paketlerinin "tır sonuna mesafe" gibi
   * anlamsız istatistikleri yok, sadece döndür + (şimdilik pasif) sil
   * aksiyonu var (bkz. plate action ring, HTML).
   */
  private selectPlatePackage(pkgId: string): void {
    this.clearMultiSelection();
    // İki seçim aynı anda anlamlı değil — tır seçimini temizle.
    this.packagesStateService.clearSelection();
    this.clearHighlights();

    const pkg = this.packagesStateService.getDeletedPackageById(pkgId) ?? null;
    this.selectedPlatePackageSignal.set(pkg);

    if (pkg?.mesh) {
      const material = pkg.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x666666);
    }

    this.renderManager.requestRender();
    this.cdr.markForCheck();
  }

  clearPlateSelection(): void {
    const pkg = this.selectedPlatePackageSignal();
    if (pkg?.mesh) {
      const material = pkg.mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x000000);
    }
    this.selectedPlatePackageSignal.set(null);
    this.renderManager.requestRender();
  }

  /**
   * Plate'te seçili paketi döndürür (length/width swap) — collision kontrolü
   * yok (plate zaten sadece bir bekleme rafı, gerçek yerleşim değil).
   * SADECE bu paketin mesh'i yeniden kurulur, diğer plate paketlerine
   * dokunulmaz (bkz. refreshSinglePlatePackageMesh, performans notu).
   */
  rotatePlatePackage(): void {
    const selected = this.selectedPlatePackageSignal();
    if (!selected) return;

    if (!selected.originalLength) {
      selected.originalLength = selected.length;
      selected.originalWidth = selected.width;
    }

    const oldLength = selected.length;
    selected.length = selected.width;
    selected.width = oldLength;
    selected.rotation = (selected.rotation || 0) + 90;
    selected.dimensions = `${selected.length}×${selected.width}×${selected.height}mm`;

    this.refreshSinglePlatePackageMesh(selected);
    // refreshSinglePlatePackageMesh mesh'i yeniden oluşturduğu için seçili
    // paketin emissive vurgusu sıfırlanır — geri uygula.
    if (selected.mesh) {
      (selected.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x666666);
    }
    this.cdr.markForCheck();
  }

  /**
   * "+" (klonla) — seçili paketi (pallet + ürün içeriği AYNEN) yeni bir
   * paket olarak siparişe ekler. Klon HER ZAMAN plate'e (yerleşmemiş
   * havuza) düşer, otomatik yerleştirilmez. Ürün detaylarının kopyalanması
   * ve kalıcı/çakışmasız numaralandırma Step2 (StepperPackageActions.
   * duplicatePackage) + backend save tarafından yapılıyor; sonucu 3D'ye
   * yaymak (plate'e ekleme, TÜM paketlerin numaralarını güncelleme) mevcut
   * syncBackendPackages$ effect'inin (stepper-result.effects.ts) işi.
   *
   * upsertMany() TEK BAŞINA yetmiyor — sadece step2State.packages'ı
   * kaydediyor. Sipariş DETAYLARININ (step1State/orderDetails, yani
   * faturadaki ürün adetleri) de güncellenmesi için ÖNCE
   * calculateOrderDetailChanges() ile step1State.added/modified/deletedIds
   * ÇAKIŞMALARI taze packages'a göre yeniden hesaplanmalı (bu alanlar sadece
   * bu action çalışınca güncellenir, otomatik değil), SONRA
   * palletControlSubmit() ile hem paket hem sipariş detay kaydı birlikte
   * tetiklenmeli — palletControlSubmit$ effect'i tam bunu yapıyor
   * (upsertMany() + StepperInvoiceUploadActions.upsertMany()).
   */
  private duplicatePackageAndSave(pkg: PackageData): void {
    this.store.dispatch(StepperPackageActions.duplicatePackage({ packageId: pkg.pkgId }));
    this.store.dispatch(StepperPackageActions.calculateOrderDetailChanges());
    this.store.dispatch(StepperPackageActions.palletControlSubmit());
  }

  duplicateSelectedPackage(): void {
    const selected = this.selectedPackageSignal();
    if (!selected) return;
    this.duplicatePackageAndSave(selected);
  }

  duplicatePlatePackage(): void {
    const selected = this.selectedPlatePackageSignal();
    if (!selected) return;
    this.duplicatePackageAndSave(selected);
  }

  /**
   * Plate'teki sil butonu — artık gerçekten siparişten kaldırıyor (Step2'den
   * silip ürünlerini kalan ürünler havuzuna geri koyuyor, backend'e kaydediyor).
   * Geri alınamaz olduğu için önce onay isteniyor. Onay sonrası ÖNCE local
   * (anlık görsel geri bildirim için mesh/seçim/plate havuzu temizliği),
   * SONRA store/backend dispatch'leri yapılır.
   */
  deletePlatePackagePermanently(): void {
    const selected = this.selectedPlatePackageSignal();
    if (!selected) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      data: {
        message: this.translate.instant('TRUCK_VISUALIZATION.STAGING_DELETE_CONFIRM_MESSAGE', { id: selected.id })
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      const pkg = selected;

      // Local — anlık görsel geri bildirim (backend round-trip beklemeden).
      if (pkg.mesh) {
        pkg.mesh.parent?.remove(pkg.mesh);
        this.disposeObjectTree(pkg.mesh);
        pkg.mesh = undefined;
      }
      this.clearPlateSelection();
      this.packagesStateService.removeFromDeletedPackages(pkg.pkgId);

      // Store/backend — Step2'den sil (ürünler kalan havuza döner) + kaydet.
      // syncBackendPackages$ (stepper-result.effects.ts) sonucu Step3'e
      // (deletedPackages + TÜM paketlerin güncel numaraları) otomatik yayar.
      // upsertMany() TEK BAŞINA sadece step2State.packages'ı kaydeder —
      // sipariş DETAYLARININ (step1State/orderDetails, faturadaki ürün
      // adetleri) de bu silmeyi yansıtması için ÖNCE
      // calculateOrderDetailChanges() (step1State.added/modified/deletedIds'i
      // taze packages'a göre yeniden hesaplar — otomatik değil, sadece bu
      // action çalışınca güncellenir), SONRA palletControlSubmit() (paket +
      // sipariş detay kaydını BİRLİKTE tetikler) gerekiyor.
      this.store.dispatch(StepperResultActions.removeDeletedPackage({ pkgId: pkg.pkgId }));
      this.store.dispatch(StepperPackageActions.removePackage({ packageId: pkg.pkgId }));
      this.store.dispatch(StepperPackageActions.calculateOrderDetailChanges());
      this.store.dispatch(StepperPackageActions.palletControlSubmit());

      // Silme, klonlamanın aksine "açık iş" bırakmaz (yerleştirilecek yeni
      // bir paket yok) — bu yüzden backend kaydı BAŞARIYLA dönünce Step3'ün
      // "kaydedilmemiş değişiklik var" (isDirty) göstergesi takılı kalmasın
      // diye açıkça temizliyoruz. applyBackendSync (syncBackendPackages$
      // effect'i, aynı upsertManySuccess'i dinliyor) isDirty'i sadece TRUE
      // yapabiliyor, hiç false'a çekmiyor — bu yüzden bu temizliği BİZ
      // yapıyoruz. Kayıt başarısız olursa (upsertManyFailure) dokunmuyoruz,
      // dirty true kalsın ki kullanıcı kaydedilmediğini görsün.
      this.actions$.pipe(
        ofType(StepperPackageActions.upsertManySuccess, StepperPackageActions.upsertManyFailure),
        take(1),
        takeUntil(this.destroy$)
      ).subscribe((action) => {
        if (action.type === StepperPackageActions.upsertManySuccess.type) {
          this.store.dispatch(StepperResultActions.setIsDirty({ isDirty: false }));
        }
      });

      this.orderResultChange();
    });
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
      // Toggle açıksa (showAllPackageLabels) etiketler seçim/highlight
      // temizlensin diye gizlenmez — sadece hover moduna dönüldüğünde
      // (toggle kapalıyken) gizlenir.
      if (!this.showAllPackageLabels) {
        pkg.detailLabelMeshes?.forEach(label => (label.visible = false));
      }
    });
    // Plate (bekleme alanı) paketleri de aynı şekilde temizlenmeli —
    // aksi halde plate'ten çıkan hover sonrası etiketler takılı kalabilir.
    if (!this.showAllPackageLabels) {
      this.packagesStateService.deletedPackages().forEach(pkg => {
        pkg.detailLabelMeshes?.forEach(label => (label.visible = false));
      });
    }
    this.reapplyMultiEmissive();
  }

  /**
   * Bir paketin detay etiketlerini göster/gizle. Gösterilecekse (henüz
   * üretilmediyse) tembel üretir. Düşük kalite modunda gizlenen etiketlerin
   * texture'ları serbest bırakılır (tekrar hover'da yeniden çizilir).
   */
  private syncDetailLabels(pkg: PackageData, show: boolean): void {
    if (!pkg.mesh) return;
    if (show) {
      this.ensureDetailLabels(pkg);
      pkg.detailLabelMeshes?.forEach(label => (label.visible = true));
    } else if (pkg.detailLabelMeshes) {
      if (this.quality.level === 'low') {
        this.releaseDetailLabels(pkg);
      } else {
        pkg.detailLabelMeshes.forEach(label => (label.visible = false));
      }
    }
  }

  private updateHoverEffectsThrottled(): void {
    if (this.hoverThrottleTimeout) return;
    this.hoverThrottleTimeout = setTimeout(() => {
      this.updateHoverEffects();
      this.hoverThrottleTimeout = null;
    }, 50);
  }

  private updateHoverEffects(): void {
    if (this.isDragging || this.groupDrag) return;

    // getIntersectedAny() hem tır (packagesGroup) hem plate (plateGroup)
    // mesh'lerini tarar — eskiden burada sadece tır-özel getIntersectedPackage()
    // kullanılıyordu, bu yüzden plate'teki (deletedPackages) paketlerin ürün
    // detay etiketleri hover'da HİÇ görünmüyordu, sadece paket sürüklenip
    // mesh'i yeniden kurulunca (refreshSinglePlatePackageMesh) görünür oluyordu.
    const intersected = this.getIntersectedAny();
    const hoveredPackage = intersected?.pkg ?? null;
    // El imleci sadece taşınabilir bir paketin üzerindeyken; boş alanda normal ok.
    this.renderer.domElement.style.cursor =
      hoveredPackage && this.dragModeEnabled && this.hasChangePerm() ? 'grab' : 'default';
    const selectedPlate = this.selectedPlatePackageSignal();

    this.processedPackagesSignal().forEach(pkg => {
      if (pkg.mesh && pkg !== this.selectedPackageSignal() && !pkg.isBeingDragged && !this.multiSet.has(pkg.pkgId)) {
        const material = pkg.mesh.material as THREE.MeshStandardMaterial;
        if (pkg === hoveredPackage) {
          material.emissive.setHex(0x333333);
        } else {
          material.emissive.setHex(0x000000);
        }
        pkg.mesh.scale.setScalar(1.0);
      }
      // Ürün detay etiketleri (üst + 4 yan yüzey) — toggle açıksa (bkz.
      // toggleAllPackageLabels()) her paket için her zaman görünür, kapalıysa
      // sadece üzerine gelinen pakette görünür.
      this.syncDetailLabels(pkg, this.showAllPackageLabels || pkg === hoveredPackage);
    });

    // Plate (bekleme alanı) paketleri için de aynı hover/etiket mantığı.
    this.packagesStateService.deletedPackages().forEach(pkg => {
      if (pkg.mesh && pkg !== selectedPlate && !pkg.isBeingDragged && !this.multiSet.has(pkg.pkgId)) {
        const material = pkg.mesh.material as THREE.MeshStandardMaterial;
        if (pkg === hoveredPackage) {
          material.emissive.setHex(0x333333);
        } else {
          material.emissive.setHex(0x000000);
        }
        pkg.mesh.scale.setScalar(1.0);
      }
      this.syncDetailLabels(pkg, this.showAllPackageLabels || pkg === hoveredPackage);
    });

    this.renderManager.requestRender();
  }

  /**
   * Ürün detay etiketlerini her zaman (hover beklemeden) gösterme/gizleme
   * aç/kapa anahtarı — toolbar'daki butona bağlıdır. Açıldığında tüm
   * paketlerin etiketleri anında görünür olur; kapatıldığında hover
   * davranışına geri döner (bir sonraki mouse hareketinde updateHoverEffects
   * sadece üzerine gelinen paketi gösterir).
   */
  toggleAllPackageLabels(): void {
    this.showAllPackageLabels = !this.showAllPackageLabels;
    this.processedPackagesSignal().forEach(pkg => {
      this.syncDetailLabels(pkg, this.showAllPackageLabels);
    });
    // Plate (bekleme alanı) paketleri de toggle'a dahil olmalı.
    this.packagesStateService.deletedPackages().forEach(pkg => {
      this.syncDetailLabels(pkg, this.showAllPackageLabels);
    });
    this.renderManager.requestRender();
    this.saveShowAllPackageLabelsPreference(this.showAllPackageLabels);
  }

  /** localStorage'da saklanan "etiketleri her zaman göster" tercihini okur. */
  private loadShowAllPackageLabelsPreference(): boolean {
    try {
      return localStorage.getItem(this.SHOW_ALL_LABELS_STORAGE_KEY) === 'true';
    } catch {
      return false; // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce varsayılana düş
    }
  }

  /** "Etiketleri her zaman göster" tercihini localStorage'a yazar. */
  private saveShowAllPackageLabelsPreference(value: boolean): void {
    try {
      localStorage.setItem(this.SHOW_ALL_LABELS_STORAGE_KEY, String(value));
    } catch {
      // localStorage kullanılamıyorsa sessizce yut — kritik bir işlev değil
    }
  }

  /**
   * Geri bildirim için sahnenin ekran görüntüsü (JPEG data URL, en fazla
   * ~1280px genişlik). WebGL tamponu render sonrası hemen okunur; alınamazsa
   * null döner (geri bildirimi engellemez).
   */
  captureScreenshot(maxWidth = 1280, quality = 0.7): string | null {
    try {
      if (!this.renderer || !this.scene || !this.camera) return null;
      this.renderer.render(this.scene, this.camera);
      const src = this.renderer.domElement;
      if (!src.width || !src.height) return null;

      const scale = Math.min(1, maxWidth / src.width);
      const out = document.createElement('canvas');
      out.width = Math.round(src.width * scale);
      out.height = Math.round(src.height * scale);
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(src, 0, 0, out.width, out.height);
      return out.toDataURL('image/jpeg', quality);
    } catch {
      return null;
    }
  }

  /** Klavye kısayolları panelini açar/kapatır ve tercihi localStorage'a yazar. */
  toggleShortcutsHint(): void {
    this.showHelp = !this.showHelp;
    this.saveShowShortcutsHintPreference(this.showHelp);
  }

  /** "Yerleşmeyen ürünler" kartını açar/kapatır ve tercihi localStorage'a yazar. */
  toggleUnplacedCard(): void {
    this.showUnplacedCard = !this.showUnplacedCard;
    try {
      localStorage.setItem(this.SHOW_UNPLACED_CARD_STORAGE_KEY, String(this.showUnplacedCard));
    } catch {
      // localStorage kullanılamıyorsa sessizce yut — kritik bir işlev değil
    }
  }

  private loadShowUnplacedCardPreference(): boolean {
    try {
      const stored = localStorage.getItem(this.SHOW_UNPLACED_CARD_STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  }

  /** localStorage'da saklanan "kısayollar panelini göster" tercihini okur. */
  private loadShowShortcutsHintPreference(): boolean {
    try {
      const stored = localStorage.getItem(this.SHOW_SHORTCUTS_HINT_STORAGE_KEY);
      // Henüz bir tercih kaydedilmemişse (ilk açılış) varsayılan olarak görünür olsun.
      return stored === null ? true : stored === 'true';
    } catch {
      return true; // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce varsayılana düş
    }
  }

  /** "Kısayollar panelini göster" tercihini localStorage'a yazar. */
  private saveShowShortcutsHintPreference(value: boolean): void {
    try {
      localStorage.setItem(this.SHOW_SHORTCUTS_HINT_STORAGE_KEY, String(value));
    } catch {
      // localStorage kullanılamıyorsa sessizce yut — kritik bir işlev değil
    }
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

    // Tır sınırı: döndürünce ayak izi tırın dışına taşıyorsa (zorla
    // yerleştirilmiş paketlerde de) konumu sınır içine çek; tır boyutundan
    // büyükse döndürmeyi reddet — paket asla tır dışına çıkamaz.
    const truckDims = this.truckDimension();
    const oldX = selected.x;
    const oldY = selected.y;
    const maxX = truckDims[0] - selected.length;
    const maxY = truckDims[1] - selected.width;
    if (maxX < 0 || maxY < 0) {
      selected.length = oldLength;
      selected.width = oldWidth;
      this.showCollisionWarningBriefly();
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.WARN_OUTSIDE_TRUCK'));
      return;
    }
    const clampedX = Math.max(0, Math.min(selected.x, maxX));
    const clampedY = Math.max(0, Math.min(selected.y, maxY));

    if (this.checkCollisionPrecise(selected, {
      x: clampedX,
      y: clampedY,
      z: selected.z
    })) {
      selected.length = oldLength;
      selected.width = oldWidth;
      this.showCollisionWarningBriefly();
      return;
    }

    selected.x = clampedX;
    selected.y = clampedY;
    if (clampedX !== oldX || clampedY !== oldY) {
      selected.mesh.position.x = clampedX + selected.length / 2;
      selected.mesh.position.z = clampedY + selected.width / 2;
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
      // Plate'e YENİ giren bir paket — henüz plate-local bir konumu yok,
      // computePlateLayout bunu sentinel (-1) görüp otomatik grid'e dizsin
      // (bkz. finalizeDragToPlate'teki aynı düzeltme).
      deletedPackage.x = -1;
      deletedPackage.y = -1;
      deletedPackage.z = -1;

      this.packagesStateService.moveToDeleted(deletedPackage.pkgId);
      this.packagesStateService.clearSelection();
      this.applyGravityToAllPackages();

      this.store.dispatch(StepperResultActions.removePackageFromTruck({ pkgId: deletedPackage.pkgId }));

      const row: PackagePosition = [
        -1, -1, -1,
        deletedPackage.length, deletedPackage.width, deletedPackage.height,
        deletedPackage.id, deletedPackage.weight, deletedPackage.pkgId
      ];
      this.store.dispatch(StepperResultActions.addDeletedPackage({ row }));

    }
  }


  restorePackage(packageData: PackageData): void {
    const realPkg = this.packagesStateService.getDeletedPackageById(packageData.pkgId) ?? packageData;

    this.saveSnapshot();
    this.isLocalOperation = true;

    this.packagesStateService.removeFromDeletedPackages(realPkg.pkgId);

    let validPosition = this.findValidPosition(realPkg);

    if (!validPosition) {
      const originalLength = realPkg.length;
      const originalWidth = realPkg.width;
      realPkg.length = originalWidth;
      realPkg.width = originalLength;
      validPosition = this.findValidPosition(realPkg);

      if (validPosition) {
        realPkg.rotation = (realPkg.rotation || 0) + 90;
        realPkg.dimensions = `${realPkg.length}×${realPkg.width}×${realPkg.height}mm`;
        if (!realPkg.originalLength) {
          realPkg.originalLength = originalWidth;
          realPkg.originalWidth = originalLength;
        }
      } else {
        realPkg.length = originalLength;
        realPkg.width = originalWidth;
      }
    }

    if (validPosition) {
      realPkg.x = validPosition.x;
      realPkg.y = validPosition.y;
      realPkg.z = validPosition.z;

      if (realPkg.originalColor) {
        realPkg.color = realPkg.originalColor;
        this.usedColors.add(realPkg.originalColor);
      } else {
        realPkg.color = this.getUniqueColor();
        realPkg.originalColor = realPkg.color;
      }

      this.createPackageMesh(realPkg);
      this.packagesStateService.addToProcessedPackages(realPkg);

      const position: PackagePosition = [
        realPkg.x, realPkg.y, realPkg.z,
        realPkg.length, realPkg.width, realPkg.height,
        realPkg.id, realPkg.weight, realPkg.pkgId
      ];
      this.store.dispatch(StepperResultActions.addPackageToTruck({ position }));
      this.store.dispatch(StepperResultActions.removeDeletedPackage({ pkgId: realPkg.pkgId }));
      this.orderResultChange();

    } else {
      this.packagesStateService.addToDeletedPackages(realPkg);
    }
  }

  clearDeletedPackages(): void {
    this.packagesStateService.clearDeletedPackages();
    this.store.dispatch(StepperResultActions.setDeletedPackages({ deletedPackages: [] }));
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
      // Alt hiyerarşi (kenar çizgileri, palet, etiketler) dahil — paylaşılan
      // palet kaynakları disposeObjectTree tarafından atlanır.
      this.disposeObjectTree(packageData.mesh);
      packageData.mesh = undefined;
      packageData.detailLabelMeshes = undefined;
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

    // CDK overlay container (mat-tooltip, mat-menu, vb.) her zaman
    // document.body'ye eklenir. Native Fullscreen API'de SADECE
    // fullscreen'e alınan elementin alt ağacı render edilir — body'nin
    // geri kalanı (dolayısıyla overlay container) tamamen görünmez olur,
    // bu yüzden tooltip'ler tam ekranda hiç görünmüyordu. Çözüm: overlay
    // container'ı fullscreen'e girerken fullscreen elementinin İÇİNE taşı,
    // çıkarken body'ye geri koy.
    const overlayContainer = document.querySelector('.cdk-overlay-container');
    if (overlayContainer) {
      if (document.fullscreenElement) {
        document.fullscreenElement.appendChild(overlayContainer);
      } else if (overlayContainer.parentElement !== document.body) {
        document.body.appendChild(overlayContainer);
      }
    }

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
    return this.formatWeight(this.frontSectionWeight);
  }

  readonly firstZoneMaxKg = computed(() => {
    const kg = Number(this.zoneWeightLimits()?.[0]?.max_kg);
    return kg > 0 ? kg : null;   // null = limit tanımsız, uyarı gösterme
  });

  get isFrontSectionOverLimit(): boolean {
    const limit = this.firstZoneMaxKg();
    return limit !== null && this.frontSectionWeight > limit;
  }
  
  private weightDepthInitEffect = effect(() => {
    const depth = this.store.selectSignal(selectFirstZoneDepthMm)();
    untracked(() => {
      this.weightCalculationDepth = depth;
      this.cdr.markForCheck();
    });
  });


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
    if (!this.isActive || this.isDragging || this.groupDrag) return;

    // Kullanıcı bir metin alanına yazıyorsa ya da bir dialog açıksa kısayollar
    // çalışmasın (aksi halde geri bildirim kutusuna "a"/"d" yazmak seçili
    // paketi klonlar/siler ve harfi yutar).
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      target?.isContentEditable ||
      this.dialog.openDialogs.length > 0
    ) {
      return;
    }

    // Tuşa basılı tutunca tekrar eden olaylar (klonla/sil/döndür/zorla yerleştir)
    // birden fazla kez işlem yapmasın. Geri al/yinele (Ctrl+Z/Y) tekrarlayabilir.
    if (event.repeat && !(event.ctrlKey || event.metaKey)) return;

    // Ctrl/Cmd+A (tümünü seç), Ctrl+D (yer imi) gibi tarayıcı kısayolları paket
    // klonlama/silme kısayollarını tetiklemesin; sadece Ctrl+Z/Y bizim.
    if ((event.ctrlKey || event.metaKey) && !['z', 'Z', 'y', 'Y'].includes(event.key)) return;

    // Rakam tuşları: Shift+1..9 = seçimi gruba ata, 1..9 = grubu seç (event.code: klavye düzeninden bağımsız)
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (digit && !event.altKey) {
      event.preventDefault();
      if (event.shiftKey) this.assignGroup(digit[1]);
      else this.selectGroupByNo(digit[1]);
      return;
    }

    switch (event.key) {
      case 'u':
      case 'U':
        if (this.multiSet.size > 1 && this.hasChangePerm()) {
          event.preventDefault();
          this.dissolveSelectedGroups();
        }
        break;

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
        } else if (this.selectedPlatePackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          this.rotatePlatePackage();
        }
        break;

      case 'Delete':
      case 'Backspace':
      case 'd':
      case 'D':
        if (this.multiSet.size > 1 && this.hasChangePerm()) {
          event.preventDefault();
          this.deleteMultiSelection();
        } else if (this.selectedPackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          this.deleteSelectedPackage();
        } else if (this.selectedPlatePackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          this.deletePlatePackagePermanently();
        }
        break;

      case 'a':
      case 'A':
        if (this.selectedPackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          this.duplicateSelectedPackage();
        } else if (this.selectedPlatePackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          this.duplicatePlatePackage();
        }
        break;

      case 'w':
      case 'W':
        if (this.selectedPackageSignal() && this.hasChangePerm()) {
          event.preventDefault();
          const selected = this.selectedPackageSignal()!;
          if (selected.isForcePlaced) {
            this.unforcePlacePackage();
          } else {
            this.forcePlacePackage();
          }
        }
        break;

      case 'Escape':
        if (this.selectedPackageSignal() || this.selectedPlatePackageSignal() || this.multiSet.size > 0) {
          event.preventDefault();
          this.clearSelection();
        }
        break;
      case 'z':
      case 'Z':
        if ((event.ctrlKey || event.metaKey) && this.hasChangePerm()) {
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

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this.renderManager.requestRender();
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  trackDeletedPackage(index: number, item: PackageData): any {
    return item.pkgId;
  }

  /**
   * Tırdaki her paket için: (1) başka bir paketin İÇİNDE mi (3 eksende AABB
   * çakışması — zorla yerleştirme çakışma kontrolünü kapattığı için
   * oluşabilir), (2) tır sınırlarının DIŞINDA mı kontrol eder; sorunlu
   * paketler için overlapWarningsSignal'i günceller (üstlerinde rozet
   * görünür). orderResultChange'ten çağrıldığı için her konum/yönelim
   * değişiminde — sürükleme sırasında da, "normale döndür" beklemeden —
   * anında yenilenir. Sonuç değişmediyse sinyale dokunmaz.
   */
  private refreshOverlapWarnings(): void {
    const packages = this.processedPackagesSignal();
    const truckDims = this.truckDimension();
    const warnings: { pkgId: string; text: string }[] = [];

    for (const pkg of packages) {
      if (pkg.isBeingDragged && pkg.y + pkg.width / 2 > truckDims[1]) continue; // plate üstünde

      const outside =
        pkg.x < -0.5 || pkg.y < -0.5 || pkg.z < -0.5 ||
        pkg.x + pkg.length > truckDims[0] + 0.5 ||
        pkg.y + pkg.width > truckDims[1] + 0.5 ||
        pkg.z + pkg.height > truckDims[2] + 0.5;

      if (outside) {
        warnings.push({
          pkgId: pkg.pkgId,
          text: this.translate.instant('TRUCK_VISUALIZATION.WARN_OUTSIDE_TRUCK'),
        });
        continue;
      }

      // Normal paketler normalde birbirleriyle çakışmaz; çakışma varsa
      // (zorla yerleştirme ya da "normale döndür" sonrası) işaretlenir.
      for (const other of packages) {
        if (other.pkgId === pkg.pkgId) continue;
        if (
          pkg.x < other.x + other.length && pkg.x + pkg.length > other.x &&
          pkg.y < other.y + other.width && pkg.y + pkg.width > other.y &&
          pkg.z < other.z + other.height && pkg.z + pkg.height > other.z
        ) {
          warnings.push({
            pkgId: pkg.pkgId,
            text: this.translate.instant('TRUCK_VISUALIZATION.WARN_INSIDE_PACKAGE'),
          });
          break;
        }
      }
    }

    const key = warnings.map(w => `${w.pkgId}:${w.text}`).join('|');
    if (key !== this.overlapWarningsKey) {
      this.overlapWarningsKey = key;
      this.overlapWarningsSignal.set(warnings);
    }
  }

  /**
   * Çakışma rozetlerinin ekran konumunu günceller (updateActionRingPosition
   * ile aynı yaklaşım: her frame, NgZone dışında, doğrudan DOM style).
   */
  private updateOverlapBadgePositions(): void {
    const layer = this.overlapLayerRef?.nativeElement;
    if (!layer || !this.camera || !this.threeContainer) return;

    const badges = layer.querySelectorAll<HTMLElement>('.tjs-overlap-badge');
    if (!badges.length) return;

    const container = this.threeContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    this.packagesGroup?.updateMatrixWorld(true);
    const packages = this.processedPackagesSignal();

    badges.forEach(el => {
      const pkg = packages.find(p => p.pkgId === el.dataset['pkg']);
      if (!pkg?.mesh) {
        el.style.display = 'none';
        return;
      }
      pkg.mesh.getWorldPosition(this.ringProjectionVector);
      this.ringProjectionVector.y += pkg.height / 2 + 60;
      this.ringProjectionVector.project(this.camera);
      if (this.ringProjectionVector.z > 1) {
        el.style.display = 'none';
        return;
      }
      const x = (this.ringProjectionVector.x * 0.5 + 0.5) * width;
      const y = (-this.ringProjectionVector.y * 0.5 + 0.5) * height;
      el.style.display = 'flex';
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
  }

  private orderResultChange(): void {
    this.refreshOverlapWarnings();
    const processed = this.processedPackagesSignal();

    const orderResult: PackagePosition[] = processed.map(pkg => [
      pkg.x, pkg.y, pkg.z,
      pkg.length, pkg.width, pkg.height,
      pkg.id, pkg.weight, pkg.pkgId
    ] as PackagePosition);

    this.ngZone.run(() => {
      if (this.skipStoreSync) {
        // Plate'teki (yerleşmeyen) bir paket sürüklenirken dirty açılmaz:
        // dirty ancak yerleşmeyen sayısı değişince (bırakma anında
        // finalizeDragFromPlate/finalizeDragToPlate) açılır.
        if (!this.isDirty() && !this.draggedFromPlate) {
          this.store.dispatch(StepperUiActions.setStep3IsDirty());
        }
        return;
      }

      this.isLocalOperation = true;
      this.store.dispatch(StepperResultActions.setOrderResult({ orderResult }));

      if (!this.isDirty()) {
        this.store.dispatch(StepperUiActions.setStep3IsDirty());
      }
    });
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
    // Mevcut mesh'leri temizle — önce TÜM alt hiyerarşiyi (kenarlar, palet
    // grubu, etiketler, forcePlaceBorder) dispose et, sonra grubu boşalt.
    // Not: dispose işlemi mesh referansı üzerinden yapılır, packagesGroup'un
    // çocuğu olmasına bağlı değildir; bu yüzden clear()'dan önce veya sonra
    // çağrılması fark etmez, ama disposeObjectTree'nin torunlara da inmesi
    // (eski koddaki gibi sadece üst mesh'i değil) asıl düzeltme budur.
    this.processedPackagesSignal().forEach(p => {
      if (p.mesh) {
        this.disposeObjectTree(p.mesh);
        p.mesh = undefined;
      }
      p.forcePlaceBorder = undefined;
    });
    this.packagesGroup.clear();

    this.packagesStateService.clearProcessedPackages();
    this.packagesStateService.clearDeletedPackages();
    this.packagesStateService.clearSelection();
    this.multiSet = new Set();
    this.store.dispatch(PackageGroupsActions.clearMultiSelection());
    // Undo/redo tüm sahneyi sıfırdan kuruyor — eski plate seçimi artık
    // geçersiz (disposed mesh) bir objeye işaret ediyor olabilir.
    this.selectedPlatePackageSignal.set(null);
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
    // KOŞULSUZ çağır (deleted boş bile olsa) — aksi halde undo ile "hiç
    // yerleşmeyen paket yok" durumuna dönüldüğünde deletedPackages signal'ı
    // değişmez, plate (bekleme alanı) eski/stale paketleri göstermeye devam
    // eder (bkz. plateVisualizationSyncEffect, sadece signal DEĞİŞİNCE
    // tetiklenir).
    this.packagesStateService.setDeletedPackages(deleted);
    this.renderManager.requestRender();
    this.cdr.markForCheck();
    this.isLocalOperation = true;
    this.orderResultChange();

    const deletedRows: PackagePosition[] = deleted.map(p => [
      -1, -1, -1, p.length, p.width, p.height, p.id, p.weight, p.pkgId
    ] as PackagePosition);
    this.store.dispatch(StepperResultActions.setDeletedPackages({ deletedPackages: deletedRows }));
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

    // Dispose packages — üst mesh'in yanı sıra kenarlar/palet grubu/etiketler
    // gibi TÜM alt hiyerarşiyi de kapsar (eski kod sadece üst mesh'i, üstelik
    // aynı işi iki kez yapıyordu).
    this.processedPackagesSignal().forEach(pkg => {
      if (pkg.mesh) {
        this.disposeObjectTree(pkg.mesh);
      }
    });
    this.disposeSharedPalletResources();

    // Plate (bekleme alanı) mesh'leri — zemin + paket mesh'leri, hepsi
    // plateGroup'un altında olduğu için tek seferde dispose edilebiliyor.
    if (this.plateGroup) {
      this.disposeObjectTree(this.plateGroup);
      this.plateFloorMesh = undefined;
    }

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
    this.groupDrag = null;
    this.isBoxSelecting = false;
    this.selectionBox.set(null);
    this.multiSet = new Set();
    this.store.dispatch(PackageGroupsActions.clearMultiSelection());
    this.packagesStateService.clearProcessedPackages();
    this.packagesStateService.clearSelection();
    // Plate seçimi de sıfırlanmalı — aksi halde sevkiyat değişince (farklı
    // pkgId seti) selectedPlatePackageSignal eski/artık geçersiz bir
    // PackageData objesine (disposed mesh) işaret etmeye devam eder ve
    // action ring "havada asılı" görünebilir.
    this.selectedPlatePackageSignal.set(null);

    if (this.packagesGroup) {
      this.processedPackagesSignal().forEach(pkg => {
        if (pkg.mesh) {
          this.disposeObjectTree(pkg.mesh);
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
      this.renderer.domElement.style.cursor = 'default';
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
    const allPackagesFromSignal = [
      ...this.processedPackagesSignal(),
      ...this.deletedPackagesSignal()
    ];

    if (allPackagesFromSignal.length === 0) return;

    // Gerçek (mesh'li/state'li) objeleri al
    const allPackages = (
      allPackagesFromSignal.map(p => {
        const real = this.packagesStateService.getProcessedPackageById(p.pkgId)
          ?? this.packagesStateService.getDeletedPackageById(p.pkgId);
        return real ? { ...real, mesh: undefined, forcePlaceBorder: undefined } : null;
      }) as (PackageData | null)[]
    ).filter((p): p is PackageData => p !== null);

    this.saveSnapshot();
    // Otomatik yerleştirme konumları baştan belirler: gruplar bozulur
    this.clearAllGroups(true);
    this.clearMultiSelection();

    allPackages.sort((a, b) => (b.length * b.width) - (a.length * a.width));

    // allPackages yukarıda mesh:undefined ile kopyalandı — asıl mesh
    // referansları hâlâ processed/deleted state'teki orijinal objelerde.
    // Grubu boşaltmadan önce onları dispose etmezsek (kenarlar, palet
    // grubu, etiketler dahil) her "Tümünü Otomatik Yerleştir" çağrısında
    // sızıntı birikir.
    allPackagesFromSignal.forEach(p => {
      if (p.mesh) {
        this.disposeObjectTree(p.mesh);
      }
    });

    if (this.packagesGroup) {
      this.packagesGroup.clear();
    }

    this.usedColors.clear();
    this.packagesStateService.clearProcessedPackages();
    this.packagesStateService.clearDeletedPackages();
    this.packagesStateService.clearSelection();

    const placed: PackageData[] = [];
    const unplaced: PackageData[] = [];

    for (const pkg of allPackages) {
      pkg.color = this.getUniqueColor();
      pkg.originalColor = pkg.color;
      pkg.isForcePlaced = false;

      const pos = this.findAutoPlacePositionWidthFirst(pkg, placed);

      if (pos) {
        pkg.x = pos.x;
        pkg.y = pos.y;
        pkg.z = pos.z;
        this.createPackageMesh(pkg);
        placed.push(pkg);
      } else {
        pkg.x = -1;
        pkg.y = -1;
        pkg.z = -1;
        unplaced.push(pkg);
      }
    }

    this.packagesStateService.setProcessedPackages(placed);

    // YENİ — store'u tamamen bu sonuca göre senkronize et
    const orderResult: PackagePosition[] = placed.map(pkg => [
      pkg.x, pkg.y, pkg.z, pkg.length, pkg.width, pkg.height,
      pkg.id, pkg.weight, pkg.pkgId
    ] as PackagePosition);

    const deletedRows: PackagePosition[] = unplaced.map(pkg => [
      -1, -1, -1, pkg.length, pkg.width, pkg.height,
      pkg.id, pkg.weight, pkg.pkgId
    ] as PackagePosition);

    this.isLocalOperation = true;
    this.store.dispatch(StepperResultActions.setOrderResult({ orderResult }));
    this.store.dispatch(StepperResultActions.setDeletedPackages({ deletedPackages: deletedRows }));

    // KOŞULSUZ çağır (bkz. applySnapshot'taki aynı düzeltme notu) — aksi
    // halde "Tümünü Otomatik Yerleştir" tüm paketleri başarıyla yerleştirdiğinde
    // (unplaced.length === 0) plate (bekleme alanı) önceki çalıştırmadan kalan
    // paketleri göstermeye devam eder.
    this.packagesStateService.setDeletedPackages(unplaced);
    if (unplaced.length > 0) {
      this.toastService.warning(this.translate.instant('TRUCK_VISUALIZATION.AUTO_PLACE_PARTIAL'));
    } else {
      this.toastService.success(this.translate.instant('TRUCK_VISUALIZATION.AUTO_PLACE_SUCCESS'));
    }

    this.renderManager.requestRender();
    this.cdr.markForCheck();
  }
  autoPlaceDeleted(): void {
    this.isLocalOperation = true;
    const deleted = [...this.deletedPackagesSignal()]; // artık computed, PackagePosition türevi
    if (deleted.length === 0) return;

    this.saveSnapshot();

    let placedCount = 0;
    let failedCount = 0;

    for (const pkgFromSignal of deleted) {
      const realPkg = this.packagesStateService.getDeletedPackageById(pkgFromSignal.pkgId);
      if (!realPkg) continue;

      realPkg.mesh = undefined;
      realPkg.forcePlaceBorder = undefined;

      const pos = this.findAutoPlacePosition(realPkg);

      if (pos) {
        realPkg.x = pos.x;
        realPkg.y = pos.y;
        realPkg.z = pos.z;
        realPkg.isForcePlaced = false;

        if (!realPkg.originalColor) {
          realPkg.color = this.getUniqueColor();
          realPkg.originalColor = realPkg.color;
        } else {
          realPkg.color = realPkg.originalColor;
          this.usedColors.add(realPkg.originalColor);
        }

        this.createPackageMesh(realPkg);
        this.packagesStateService.removeFromDeletedPackages(realPkg.pkgId);
        this.packagesStateService.addToProcessedPackages(realPkg);

        // YENİ — store senkronizasyonu
        const position: PackagePosition = [
          realPkg.x, realPkg.y, realPkg.z,
          realPkg.length, realPkg.width, realPkg.height,
          realPkg.id, realPkg.weight, realPkg.pkgId
        ];
        this.store.dispatch(StepperResultActions.addPackageToTruck({ position }));
        this.store.dispatch(StepperResultActions.removeDeletedPackage({ pkgId: realPkg.pkgId }));

        placedCount++;
      } else {
        failedCount++;
      }
    }

    // Otomatik yerleştirilen paketleri içeren gruplar bozulur
    if (placedCount > 0) {
      const placedIds = new Set(deleted
        .filter(d => !!this.packagesStateService.getProcessedPackageById(d.pkgId))
        .map(d => d.pkgId));
      let dissolved = false;
      for (const [no, members] of Object.entries(this.groupsSignal())) {
        if (members.some(id => placedIds.has(id))) {
          this.store.dispatch(PackageGroupsActions.dissolveGroup({ no: this.groupKey(no) }));
          dissolved = true;
        }
      }
      if (dissolved) this.toastService.info(this.translate.instant('TRUCK_VISUALIZATION.GROUPS_CLEARED'));
      this.clearMultiSelection();
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

}
