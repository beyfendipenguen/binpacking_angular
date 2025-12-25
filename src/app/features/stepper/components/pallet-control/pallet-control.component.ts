import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  AfterViewInit,
  OnDestroy,
  WritableSignal,
  computed,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  CdkDragStart,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { UiProduct } from '../ui-models/ui-product.model';
import { UiPallet } from '../ui-models/ui-pallet.model';
import { UiPackage } from '../ui-models/ui-package.model';
import { Store } from '@ngrx/store';
import { v4 as Guid } from 'uuid';

import {
  selectRemainingProducts,
  selectIsOrderDetailsDirty,
  selectUiPackages,
  allDropListIds,
  hasPackages,
  hasRemainingProduct,
  packageDropListIds,
  palletDropListIds,
  remainingProductCount,
  selectOrder,
  uiPackageCount,
  selectAveragePackageWeight,
  selectHeaviestPackageWeight,
  selectLightestPackageWeight,
  selectRemainingArea,
  selectRemainingWeight,
  selectTotalPackagesMeter,
  selectTotalPackageWeight,
  selectVerticalSort,
  selectUiPallets,
  selectIsPackagesDirty,
  AppState,
} from '@app/store';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatAutocompleteModule,
} from '@angular/material/autocomplete';
import { MatOption } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '@app/core/services/toast.service';
import { ProductService } from '@app/features/services/product.service';
import { CancelConfirmationDialogComponent } from '@app/shared/cancel-confirmation-dialog/cancel-confirmation-dialog.component';
import { RepositoryService } from '../../services/repository.service';
import { StepperPackageActions } from '@app/store/stepper/actions/stepper-package.actions';
import { StepperUiActions } from '@app/store/stepper/actions/stepper-ui.actions';
import { PackageDetailReadDto } from '@app/features/interfaces/package-detail.interface';
import { Product } from '@app/features/interfaces/product.interface';
import { HasPermissionDirective } from '@app/core/auth/directives/has-permission.directive';
import { DisableAuthDirective } from '@app/core/auth/directives/disable-auth.directive';
import { Pallet } from '@app/features/interfaces/pallet.interface';
import { PalletService } from '@app/features/services/pallet.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-pallet-control',
  imports: [FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatStepperModule,
    MatButtonModule,
    MatInputModule,
    MatTableModule,
    MatCardModule,
    CommonModule,
    CdkDropList,
    CdkDrag,
    MatIconModule,
    MatProgressSpinnerModule,
    MatOption,
    MatAutocompleteModule,
    MatTooltipModule,
    MatCheckboxModule,
    TranslateModule,
    HasPermissionDirective,
    DisableAuthDirective
  ],
  templateUrl: './pallet-control.component.html',
  styleUrl: './pallet-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalletControlComponent
  implements OnInit, AfterViewInit, OnDestroy {

  private translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  //product search
  searchControl = new FormControl('');
  isSearching = false;
  filteredProducts: WritableSignal<any[]> = signal<any[]>([]);
  //pallet search
  palletSearchControl = new FormControl('');
  isPalletSearching = false;
  filteredPalletsFromBackend: WritableSignal<Pallet[]> = signal<Pallet[]>([]);

  // Service injections
  repository: RepositoryService = inject(RepositoryService);
  toastService: ToastService = inject(ToastService);
  private readonly store = inject(Store<AppState>);
  private readonly productService = inject(ProductService);
  private readonly palletService = inject(PalletService);

  uiPackages = this.store.selectSignal(selectUiPackages);
  remainingProducts = this.store.selectSignal(selectRemainingProducts);

  public orderDetailsIsDirtySignal =
    this.store.selectSignal(selectIsOrderDetailsDirty);

  public isDirtySignal = this.store.selectSignal(selectIsPackagesDirty);
  public orderSignal = this.store.selectSignal(selectOrder);
  public verticalSortSignal = this.store.selectSignal(selectVerticalSort);

  private autoSaveTimeout: any;
  private destroy$ = new Subject<void>();

  public availablePallets = this.store.selectSignal(selectUiPallets);

  public hasPackages = this.store.selectSignal(hasPackages);
  public uiPackageCount = this.store.selectSignal(uiPackageCount);
  public hasRemainingProduct = this.store.selectSignal(hasRemainingProduct);
  public remainingProductCount = this.store.selectSignal(remainingProductCount);
  public allDropListIds = this.store.selectSignal(allDropListIds);
  public packageDropListIds = this.store.selectSignal(packageDropListIds);
  public palletDropListIds = this.store.selectSignal(palletDropListIds);

  // Form and other properties
  secondFormGroup: FormGroup;
  currentDraggedProduct: PackageDetailReadDto | null = null;

  //Sorting Process
  sortAscending = signal<boolean>(false);

  // Weight and dimension calculations
  public totalWeight = this.store.selectSignal(selectTotalPackageWeight);

  public remainingWeight = this.store.selectSignal(selectRemainingWeight);
  public totalMeter = this.store.selectSignal(selectTotalPackagesMeter);
  public remainingArea = this.store.selectSignal(selectRemainingArea);

  public heaviestPalletWeight = this.store.selectSignal(
    selectHeaviestPackageWeight
  );
  public lightestPalletWeight = this.store.selectSignal(
    selectLightestPackageWeight
  );
  public averagePalletWeight = this.store.selectSignal(
    selectAveragePackageWeight
  );

  // Pallet weight analytics
  constructor(private _formBuilder: FormBuilder) {
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.setupSearchSubscription();
    this.setupPalletSearchSubscription();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
  }


  packageTotalWeight(pkg: UiPackage): number {
    const order = this.orderSignal();
    const palletWeight = Number(pkg.pallet?.weight) || 0;
    const productsWeight = pkg.package_details.reduce((total, packageDetail) => {
      if (!order) {
        return 0;
      }
      let weight = 0;
      if (order.weight_type == 'std') {
        weight = Number(packageDetail.product.weight_type?.std) || 0;
      } else if (order.weight_type == 'eco') {
        weight = Number(packageDetail.product.weight_type?.eco) || 0;
      } else {
        weight = Number(packageDetail.product.weight_type?.pre) || 0;
      }
      const count = Number(packageDetail.count) || 0;
      return total + (weight * count);
    }, 0);

    const totalWeight = palletWeight + productsWeight;

    // Sonucu noktadan sonra 2 haneye yuvarla
    return Math.round(totalWeight * 100) / 100;
  }

  // Dimension and fit checking methods
  canFitPackageDetailToPallet(
    packageDetail: PackageDetailReadDto,
    pallet: UiPallet,
    existingPackageDetails: PackageDetailReadDto[]
  ): boolean {
    if (!this.checkDimensionsFit(packageDetail, pallet)) {
      return false;
    }
    return this.checkVolumeAvailable(packageDetail, pallet, existingPackageDetails);
  }

  //Sorting css optimize process
  toggleSort() {
    this.sortAscending.set(!this.sortAscending());
    const multiplier = this.sortAscending() ? 1 : -1;

    const remainingProducts = [...this.remainingProducts()].sort((a, b) => {
      return multiplier * (
        (b.product.dimension.depth - a.product.dimension.depth) ||      // Önce depth (büyükten küçüğe)
        (b.product.dimension.width - a.product.dimension.width) ||      // Sonra width (büyükten küçüğe)
        (b.product.dimension.height - a.product.dimension.height) ||    // Sonra height (büyükten küçüğe)
        (b.count - a.count)                             // Son olarak count (büyükten küçüğe)
      );
    });

    this.store.dispatch(StepperPackageActions.setRemainingProducts({ remainingProducts }));
  }

  //merge remaining products process
  merge() {
    this.store.dispatch(StepperPackageActions.mergeRemainingProducts())
  }

  private checkDimensionsFit(packageDetail: PackageDetailReadDto, pallet: UiPallet): boolean {
    if (!packageDetail?.product.dimension || !pallet?.dimension) {
      return false;
    }

    const safeProductWidth = this.safeNumber(packageDetail.product.dimension.width);
    const safeProductDepth = this.safeNumber(packageDetail.product.dimension.depth);
    const safeProductHeight = this.safeNumber(packageDetail.product.dimension.height);
    const safePalletWidth = this.safeNumber(pallet.dimension.width);
    const safePalletDepth = this.safeNumber(pallet.dimension.depth);
    const safePalletHeight = this.safeNumber(pallet.dimension.height);

    if (safeProductHeight > safePalletHeight) {
      return false;
    }

    const normalFit =
      safeProductWidth <= safePalletWidth &&
      safeProductDepth <= safePalletDepth;
    const rotatedFit =
      safeProductWidth <= safePalletDepth &&
      safeProductDepth <= safePalletWidth;

    return normalFit || rotatedFit;
  }

  private checkVolumeAvailable(
    packageDetail: PackageDetailReadDto,
    pallet: UiPallet,
    existingPackageDetails: PackageDetailReadDto[]
  ): boolean {
    if (!packageDetail?.product.dimension || !pallet?.dimension) {
      return false;
    }

    const palletTotalVolume =
      this.safeNumber(pallet.dimension.width) *
      this.safeNumber(pallet.dimension.depth) *
      this.safeNumber(pallet.dimension.height);

    const usedVolume = this.calculateUsedVolume(existingPackageDetails);

    const newProductVolume =
      this.safeNumber(packageDetail.product.dimension.width) *
      this.safeNumber(packageDetail.product.dimension.depth) *
      this.safeNumber(packageDetail.product.dimension.height) *
      this.safeNumber(packageDetail.count);

    return newProductVolume <= palletTotalVolume - usedVolume;
  }

  private calculateUsedVolume(packageDetails: PackageDetailReadDto[]): number {
    if (packageDetails.length === 0) return 0;

    return packageDetails.reduce((total, packageDetail) => {
      if (!packageDetail?.product.dimension) {
        return total;
      }
      const volume =
        this.safeNumber(packageDetail.product.dimension.width) *
        this.safeNumber(packageDetail.product.dimension.depth) *
        this.safeNumber(packageDetail.product.dimension.height) *
        this.safeNumber(packageDetail.count);
      return total + volume;
    }, 0);
  }

  private safeNumber(value: any): number {
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : value;
    }

    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }

    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'object' && value.value !== undefined) {
      return this.safeNumber(value.value);
    }

    return 0;
  }

  getRemainingPalletVolume(
    pallet: UiPallet,
    existingPacakgeDetails: PackageDetailReadDto[]
  ): number {
    if (!pallet?.dimension) {
      return 0;
    }
    const palletTotalVolume =
      this.safeNumber(pallet.dimension.width) *
      this.safeNumber(pallet.dimension.depth) *
      this.safeNumber(pallet.dimension.height);
    const usedVolume = this.calculateUsedVolume(existingPacakgeDetails);
    return Math.max(0, palletTotalVolume - usedVolume);
  }

  getPalletFillPercentage(
    pallet: UiPallet,
    existingPacakgeDetails: PackageDetailReadDto[]
  ): number {
    if (!pallet?.dimension) {
      return 0;
    }
    const palletTotalVolume =
      this.safeNumber(pallet.dimension.width) *
      this.safeNumber(pallet.dimension.depth) *
      this.safeNumber(pallet.dimension.height);
    const usedVolume = this.calculateUsedVolume(existingPacakgeDetails);
    return Math.round((usedVolume / palletTotalVolume) * 100);
  }

  getMaxProductCount(
    packageDetail: PackageDetailReadDto,
    pallet: UiPallet,
    existingPacakgeDetails: PackageDetailReadDto[]
  ): number {
    if (!packageDetail?.product.dimension || !pallet?.dimension) {
      return 0;
    }

    if (!this.checkDimensionsFit(packageDetail, pallet)) {
      return 0;
    }

    const remainingVolume = this.getRemainingPalletVolume(
      pallet,
      existingPacakgeDetails
    );
    const singleProductVolume =
      this.safeNumber(packageDetail.product.dimension.width) *
      this.safeNumber(packageDetail.product.dimension.depth) *
      this.safeNumber(packageDetail.product.dimension.height);

    return Math.floor(remainingVolume / singleProductVolume);
  }

  updatePackageDetailCount(packageDetail: PackageDetailReadDto, event: any): void {
    // Bu metodu sen doldur - product count güncellemesi için
    const newCount = parseInt(event.target.value);
    if (Number.isNaN(newCount) || newCount < 1) {
      // geçersiz inputu görmezden gel
      return;
    }
    this.store.dispatch(
      StepperPackageActions.upsertPackageDetailCount({ packageDetail, count: newCount })
    );
  }

  palletSearchValue = toSignal(
    this.palletSearchControl.valueChanges.pipe(startWith('')),
    { initialValue: '' }
  );

  displayedPallets = computed(() => {
    const searchValue = this.palletSearchValue();
    const allPallets = this.availablePallets();

    if (!searchValue || typeof searchValue !== 'string' || searchValue.trim().length === 0) {
      return allPallets;
    }

    return this.filterPalletsByQuery(searchValue, allPallets);
  });

  private setupPalletSearchSubscription(): void {
    this.palletSearchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((value) => {
          if (typeof value === 'string' && value.trim().length > 1) {

            const storePallets = this.availablePallets();
            const localResults = this.filterPalletsByQuery(value, storePallets);

            if (localResults.length > 0) {
              this.filteredPalletsFromBackend.set([]);
              return of([]);
            }

            this.isPalletSearching = true;
            return this.palletService.searchPalletsWithParsedQuery(value, 10).pipe(
              catchError((error) => {
                return of([]);
              }),
              finalize(() => {
                this.isPalletSearching = false;
              })
            );
          }

          this.filteredPalletsFromBackend.set([]);
          return of([]);
        })
      )
      .subscribe({
        next: (pallets: Pallet[]) => {
          this.filteredPalletsFromBackend.set(pallets);
        },
      });
  }

  private filterPalletsByQuery(query: string, pallets: any[]): any[] {
    if (!pallets || pallets.length === 0) {
      return [];
    }

    const trimmedQuery = query.toLowerCase().trim();
    const hasX = /\s*x\s*/i.test(trimmedQuery);
    let searchDepth: number | null = null;
    let searchWidth: number | null = null;

    if (hasX || trimmedQuery.includes(' ')) {
      const parts = trimmedQuery.split(/\s*x\s*|\s+/i)
        .map(p => p.trim())
        .filter(p => p.length > 0 && !isNaN(Number(p)))
        .map(p => Number(p));

      if (parts.length === 2) {
        searchDepth = parts[0];
        searchWidth = parts[1];
      } else if (parts.length === 1) {
        searchDepth = searchWidth = parts[0];
      }
    } else if (!isNaN(Number(trimmedQuery))) {
      searchDepth = searchWidth = Number(trimmedQuery);
    }

    return pallets.filter((pallet) => {
      if (pallet.name && pallet.name.toLowerCase().includes(trimmedQuery)) {
        return true;
      }

      if (pallet.dimension) {
        const palletDepth = Math.trunc(pallet.dimension.depth);
        const palletWidth = Math.trunc(pallet.dimension.width);

        if (searchDepth !== null && searchWidth !== null) {
          if (searchDepth !== searchWidth) {
            return palletDepth === searchDepth && palletWidth === searchWidth;
          } else {
            return palletDepth === searchDepth || palletWidth === searchWidth;
          }
        }
      }

      return false;
    });
  }

  selectPallet(pallet: Pallet) {
    const palletData = {
      ui_id: Guid(),
      id: pallet.id,
      dimension: pallet.dimension,
      weight: pallet.weight,
      company: pallet.company
    };

    this.store.dispatch(
      StepperPackageActions.addPalletToAvailable({
        pallet: palletData as any,
      })
    );

    this.clearPalletSearch();
  }

  clearPalletSearch(): void {
    this.palletSearchControl.setValue('');
    this.filteredPalletsFromBackend.set([]);
    this.isPalletSearching = false;
  }

  displayPalletFn(pallet: any): string {
    return pallet?.dimension?.depth != null && pallet?.dimension?.width != null
      ? `${Math.trunc(pallet.dimension.depth)} X ${Math.trunc(pallet.dimension.width)}`
      : '';
  }

  selectProduct(product: Product) {
    const newPackageDetail = {
      id: Guid(),
      count: 0,
      package_id: Guid(),
      priority: 0,
      product
    } as PackageDetailReadDto

    this.store.dispatch(
      StepperPackageActions.upsertPackageDetailCount({
        packageDetail: newPackageDetail,
      })
    );
    // Seçimden sonra aramayı temizle (opsiyonel)
    this.clearSearch();
  }

  displayProductFn(packageDetail: PackageDetailReadDto): string {
    return packageDetail?.product?.name ? packageDetail.product.name : '';
  }

  private setupSearchSubscription(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(500), // 300 → 500 (daha az istek)
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((value) => {
          if (typeof value === 'string' && value.length > 2) {
            this.isSearching = true;
            return this.productService.searchProductsWithParsedQuery(value, 10).pipe( // Yeni parse servisini kullan
              catchError((error) => {
                return of([]);
              }),
              finalize(() => {
                this.isSearching = false;
              })
            );
          }
          // Kısa giriş yapınca listeyi temizle
          this.filteredProducts.set([]);
          return of([]);
        })
      )
      .subscribe({
        next: (products: Product[]) => {
          this.filteredProducts.set(products);
        },
      });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.filteredProducts.set([]);
    this.isSearching = false;
  }

  // Drag & Drop Event Handlers
  dropPackageDetailToPackage(event: CdkDragDrop<PackageDetailReadDto[]>): void {
    if (event.previousContainer === event.container) {
      if (event.container.id === 'productsList') {
        this.store.dispatch(
          StepperPackageActions.remainingProductMoveProduct({
            previousIndex: event.previousIndex,
            currentIndex: event.currentIndex,
          })
        );
      } else {
        this.store.dispatch(
          StepperPackageActions.movePackageDetailInSamePackage({
            currentIndex: event.currentIndex,
            previousIndex: event.previousIndex,
            packageId: event.container.id,
          })
        );
      }
      return;
    }

    // Paletten available products'a geri alma
    if (event.container.id === 'productsList') {
      this.store.dispatch(
        StepperPackageActions.movePackageDetailToRemainingProducts({
          packageDetails: event.previousContainer.data,
          previousIndex: event.previousIndex,
          previousContainerId: event.previousContainer.id,
        })
      );
      return;
    }

    // Hedef palet bulma
    const targetPalletId = event.container.id;
    const currentPackages = this.uiPackages();
    const targetPackage = currentPackages.find(
      (p) => p.pallet && p.pallet.ui_id === targetPalletId
    );

    if (!targetPackage) {
      return;
    }

    // Source container'ın palet mi yoksa productsList mi olduğunu kontrol et
    const isSourceFromPallet = event.previousContainer.id !== 'productsList';
    const packageDetail = event.previousContainer.data[event.previousIndex];

    if (isSourceFromPallet) {
      const sourcePackage = currentPackages.find(
        (pkg) => pkg.pallet && pkg.pallet.ui_id === event.previousContainer.id
      );

      if (sourcePackage) {
        // Sığma kontrolü
        if (targetPackage.pallet) {
          const fitResult = this.calculateMaxFitCount(
            packageDetail,
            targetPackage.pallet,
            targetPackage.package_details
          );

          if (fitResult.maxCount === 0) {
            // Hiç sığmıyor
            const fillPercentage = this.getPalletFillPercentage(
              targetPackage.pallet,
              targetPackage.package_details
            );
            this.toastService.error(
              `${this.translate.instant('PALLET_CONTROL.PRODUCT_WONT_FIT')} %${fillPercentage}`,
              this.translate.instant('PALLET_CONTROL.SIZE_ERROR')
            );
            return;
          } else if (fitResult.maxCount < packageDetail.count) {
            // Kısmi sığıyor - YENİ DURUM
            this.toastService.warning(
              `${packageDetail.count} ${this.translate.instant('PALLET_CONTROL.FROM')} ${fitResult.maxCount} ${this.translate.instant('PALLET_CONTROL.ADDED_TO_PALLET')}`,
              this.translate.instant('PALLET_CONTROL.PARTIAL_TRANSFER')
            );
            this.store.dispatch(
              StepperPackageActions.movePartialPackageDetailBetweenPackages({
                sourcePackageId: sourcePackage.id,
                targetPackageId: targetPackage.id,
                previousIndex: event.previousIndex,
                maxCount: fitResult.maxCount,
              })
            );
            return;
          }
        }
        // Normal transfer
        this.store.dispatch(
          StepperPackageActions.movePackageDetailInPackageToPackage({
            sourcePackageId: sourcePackage.id,
            targetPackageId: targetPackage.id,
            previousIndex: event.previousIndex,
          })
        );
        return;
      }
    }

    // Available products'tan palete transfer
    if (targetPackage.pallet) {
      const fitResult = this.calculateMaxFitCount(
        packageDetail,
        targetPackage.pallet,
        targetPackage.package_details
      );
      if (fitResult.maxCount === 0) {
        // Hiç sığmıyor
        const fillPercentage = this.getPalletFillPercentage(
          targetPackage.pallet,
          targetPackage.package_details
        );
        this.toastService.error(
          `${this.translate.instant('PALLET_CONTROL.PRODUCT_WONT_FIT')} %${fillPercentage}`,
          this.translate.instant('PALLET_CONTROL.SIZE_ERROR')
        );
        return;
      } else if (fitResult.maxCount < packageDetail.count) {
        // Kısmi sığıyor
        this.toastService.warning(
          `${packageDetail.count} ${this.translate.instant('PALLET_CONTROL.FROM')} ${fitResult.maxCount} ${this.translate.instant('PALLET_CONTROL.ADDED_TO_PALLET')}`,
          this.translate.instant('PALLET_CONTROL.PARTIAL_TRANSFER')
        );
        this.store.dispatch(
          StepperPackageActions.movePartialRemainingProductToPackage({
            targetPackageId: targetPackage.id,
            previousIndex: event.previousIndex,
            maxCount: fitResult.maxCount,
          })
        );
        return;
      }
    }
    // Normal transfer
    this.store.dispatch(
      StepperPackageActions.moveRemainingProductToPackage({
        targetPackageId: targetPackage.id,
        previousIndex: event.previousIndex,
      })
    );
    return;
  }

  dropPalletToPackage(event: CdkDragDrop<any>): void {
    if (event.previousContainer === event.container) return;
    this.store.dispatch(
      StepperPackageActions.movePalletToPackage({
        containerId: event.container.id,
        previousIndex: event.previousIndex,
        previousContainerData: event.previousContainer.data,
      })
    );
  }

  dragStarted(event: CdkDragStart): void {
    const packageDetail = event.source.data as PackageDetailReadDto;
    this.currentDraggedProduct = packageDetail;
    const palletElements = new Map<string, HTMLElement>();

    if (!packageDetail?.product.dimension) {
      this.toastService.error(this.translate.instant('PALLET_CONTROL.MISSING_SIZE_INFO'));
      return;
    }

    this.uiPackages().forEach((pkg, index) => {
      if (pkg.pallet) {
        const palletElement = document.getElementById(pkg.pallet.ui_id);
        if (palletElement) {
          palletElements.set(pkg.pallet.ui_id, palletElement);
        }
      }
    });

    this.uiPackages().forEach((pkg, index) => {
      if (pkg.pallet) {
        const fitResult = this.calculateMaxFitCount(
          packageDetail,
          pkg.pallet,
          pkg.package_details
        );
        const palletElement = palletElements.get(pkg.pallet.ui_id);

        if (palletElement) {
          if (fitResult.maxCount === 0) {
            // Hiç sığmıyor - KIRMIZI
            palletElement.classList.add('cannot-drop');
            palletElement.classList.remove('can-drop', 'partial-drop');

            const fillPercentage = this.getPalletFillPercentage(pkg.pallet, pkg.package_details);
            palletElement.title = `${this.translate.instant('PALLET_CONTROL.WONT_FIT')} %${fillPercentage}`;

          } else if (fitResult.maxCount < packageDetail.count) {
            // Kısmi sığıyor
            palletElement.classList.add('partial-drop');
            palletElement.classList.remove('can-drop', 'cannot-drop');

            const fillPercentage = this.getPalletFillPercentage(pkg.pallet, pkg.package_details);
            palletElement.title = `${this.translate.instant('PALLET_CONTROL.ONLY')} ${fitResult.maxCount} ${this.translate.instant('PALLET_CONTROL.PIECES_FIT')}`;

          } else {
            // Tamamen sığıyor - YEŞİL
            palletElement.classList.add('can-drop');
            palletElement.classList.remove('cannot-drop', 'partial-drop');

            palletElement.title = `${this.translate.instant('PALLET_CONTROL.MAX_FIT')} ${fitResult.maxCount} ${this.translate.instant('PALLET_CONTROL.PIECES_CAN_FIT')}`;
          }
        }
      }
    });
  }

  dragEnded(): void {
    this.currentDraggedProduct = null;

    document.querySelectorAll('.can-drop, .cannot-drop, .partial-drop').forEach((el) => {
      el.classList.remove('can-drop', 'cannot-drop', 'partial-drop');
    });
  }

  calculateMaxFitCount(packageDetail: PackageDetailReadDto, pallet: UiPallet, existingPacakgeDetails: PackageDetailReadDto[]): { canFit: boolean; maxCount: number } {
    // Tek bir ürünün boyutsal olarak sığıp sığmadığını kontrol et
    const singleProductCanFit = this.canFitPackageDetailToPallet(
      {
        ...packageDetail,
        count: 1,
      },
      pallet,
      existingPacakgeDetails
    );

    if (!singleProductCanFit) {
      return { canFit: false, maxCount: 0 };
    }

    // Palet kapasitesi
    const palletCapacity =
      pallet.dimension.depth * pallet.dimension.width * pallet.dimension.height;

    // Mevcut ürünlerin toplam hacmi
    const usedVolume = existingPacakgeDetails.reduce((total, pd) => {
      const productVolume =
        pd.product.dimension.depth * pd.product.dimension.width * pd.product.dimension.height;
      return total + productVolume * pd.count;
    }, 0);

    // Kalan hacim
    const remainingVolume = palletCapacity - usedVolume;

    // Bir adet ürünün hacmi
    const productVolume =
      packageDetail.product.dimension.depth *
      packageDetail.product.dimension.width *
      packageDetail.product.dimension.height;

    // Maksimum kaç adet sığabilir
    const maxCount = Math.floor(remainingVolume / productVolume);

    // Product count'tan fazla olamaz
    const finalMaxCount = Math.min(maxCount, packageDetail.count);

    return {
      canFit: true,
      maxCount: finalMaxCount,
    };
  }

  // Product manipulation methods
  splitProduct(packageDetailId: string, splitCount?: number | null): void {
    this.store.dispatch(
      StepperPackageActions.splitPackageDetail({ packageDetailId, splitCount: splitCount ?? null })
    );
  }

  removePackageDetailFromPackage(pkgId: string, packageDetailIndex: number): void {
    this.store.dispatch(
      StepperPackageActions.removePackageDetailFromPackage({
        pkgId,
        packageDetailIndex,
      })
    );
  }

  removeAllPackage(): void {
    this.store.dispatch(StepperPackageActions.removeAllPackage());
  }

  removePackage(packageToRemove: any): void {
    this.store.dispatch(StepperPackageActions.removePackage({ packageId: packageToRemove.id }));
  }

  removePalletFromPackage(packageItem: UiPackage): void {
    this.store.dispatch(
      StepperPackageActions.removePalletFromPackage({
        packageId: packageItem.id,
      })
    );
  }

  onVerticalSortChange(value: boolean): void {
    this.store.dispatch(StepperPackageActions.setVerticalSort({ verticalSort: value }));
  }

  calculatePackageDetail() {
    if (!this.orderDetailsIsDirtySignal())
      this.store.dispatch(StepperPackageActions.calculatePackageDetail());
  }

  toggleAlignment(_package: any): void {
    _package.alignment = _package.alignment === 'v' ? 'h' : 'v';
    this.store.dispatch(StepperPackageActions.setVerticalSortInPackage({ pkgId: _package.id, alignment: _package.alignment }))
  }

  addPackageDetail(packageDetailId: string) {
    this.store.dispatch(StepperPackageActions.addPackageDetailToRemainingProducts({ packageDetailId }));
  }

  reducePackageDetail(packageDetailId: string) {
    this.store.dispatch(StepperPackageActions.reducePackageDetailCount({ packageDetailId }));
  }

  deleteRemainingProducts(packageDetailIds: string[]): void {
    this.store.dispatch(StepperPackageActions.deleteRemainingProducts({ packageDetailIds }));
  }


  submitForm(): void {
    if (this.remainingProductCount() > 0) {
      const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
        width: '400px',
        maxWidth: '95vw',
        disableClose: true,
        panelClass: 'cancel-confirmation-dialog',
        data: {
          header: this.translate.instant('PALLET_CONTROL.UNPLACED_PRODUCTS_WARNING'),
          title: this.translate.instant('PALLET_CONTROL.MUST_PLACE_REMAINING'),
          info: this.translate.instant('PALLET_CONTROL.CONTINUE_WARNING'),
          confirmButtonText: this.translate.instant('PALLET_CONTROL.CONTINUE_ANYWAY'),
          showYesButton: true,
          rejectButtonText: this.translate.instant('PALLET_CONTROL.GO_BACK')
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result === true) {
          const packageDetailIds = this.remainingProducts().map(detail => detail.id);
          this.deleteRemainingProducts(packageDetailIds)
          this.submitForm()
        } else {
          return;
        }

      });
    }
    else if (this.isDirtySignal()) {
      this.store.dispatch(StepperPackageActions.palletControlSubmit());
    } else {
      this.store.dispatch(StepperUiActions.navigateToStep({ stepIndex: 2 }))
    }
  }

  goPreviousStep() {
    this.store.dispatch(StepperUiActions.navigateToStep({ stepIndex: 0 }))
  }

}
