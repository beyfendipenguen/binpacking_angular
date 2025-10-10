import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  AfterViewInit,
  OnDestroy,
  WritableSignal,
} from '@angular/core';
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
import { RepositoryService } from '../../services/repository.service';
import { UiProduct } from '../ui-models/ui-product.model';
import { UiPallet } from '../ui-models/ui-pallet.model';
import { UiPackage } from '../ui-models/ui-package.model';
import { ToastService } from '../../../../../services/toast.service';
import { Store } from '@ngrx/store';
import {
  addUiProductToRemainingProducts,
  AppState,
  movePalletToPackage,
  moveProductToRemainingProducts,
  moveRemainingProductToPackage,
  moveUiProductInPackageToPackage,
  moveUiProductInSamePackage,
  palletControlSubmit,
  remainingProductMoveProduct,
  removeAllPackage,
  removePackage,
  removePalletFromPackage,
  removeProductFromPackage,
  splitProduct,
  updateProductCountAndCreateOrUpdateOrderDetail,
  deleteRemainingProduct,
  updateOrderDetailsChanges,
  calculatePackageDetail
} from '../../../../../store';

import {
  selectStep2Packages,
  selectRemainingProducts,
  selectStep2IsDirty,
  selectStep1IsDirty,
  selectStep2Changes,
  selectUiPackages,
  allDropListIds,
  hasPackage,
  hasRemainingProduct,
  packageDropListIds,
  palletDropListIds,
  remainingProductCount,
  selectOrder,
  uiPackageCount,
  selectAveragePalletWeight,
  selectHeaviestPalletWeight,
  selectLightestPalletWeight,
  selectRemainingArea,
  selectRemainingWeight,
  selectTotalMeter,
  selectTotalWeight,
} from '../../../../../store/stepper/stepper.selectors';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  Subject,
  switchMap,
  takeUntil
} from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../../services/product.service';
import { MatAutocomplete, MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatOption } from '@angular/material/autocomplete';

@Component({
  selector: 'app-pallet-control',
  imports: [
    FormsModule,
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
    MatAutocompleteModule
  ],
  templateUrl: './pallet-control.component.html',
  styleUrl: './pallet-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalletControlComponent
  implements OnInit, AfterViewInit, OnDestroy {
  searchControl = new FormControl('');
  isSearching = false;
  filteredProducts: WritableSignal<any[]> = signal<any[]>([]);

  // Service injections
  repository: RepositoryService = inject(RepositoryService);
  toastService: ToastService = inject(ToastService);
  private readonly store = inject(Store<AppState>);
  private readonly productService = inject(ProductService);

  uiPackages = this.store.selectSignal(selectUiPackages);
  remainingProducts = this.store.selectSignal(selectRemainingProducts);

  // NgRx Step2 Migration Observables
  public step2Packages$ = this.store.select(selectStep2Packages);
  public step2RemainingProducts$ = this.store.select(
    selectRemainingProducts
  );
  public step2IsDirty$ = this.store.select(selectStep2IsDirty);
  public step2Changes$ = this.store.select(selectStep2Changes);

  public orderDetailsIsDirtySignal = this.store.selectSignal(selectStep1IsDirty);

  public isDirtySignal = this.store.selectSignal(selectStep2IsDirty);
  public orderSignal = this.store.selectSignal(selectOrder);

  private autoSaveTimeout: any;
  private destroy$ = new Subject<void>();

  public availablePallets = signal<UiPallet[]>([]);
  public selectedPallets = signal<UiPallet[]>([]);

  public hasPackage = this.store.selectSignal(hasPackage);
  public uiPackageCount = this.store.selectSignal(uiPackageCount);
  public hasRemainingProduct = this.store.selectSignal(hasRemainingProduct);
  public remainingProductCount = this.store.selectSignal(remainingProductCount);
  public allDropListIds = this.store.selectSignal(allDropListIds);
  public packageDropListIds = this.store.selectSignal(packageDropListIds);
  public palletDropListIds = this.store.selectSignal(palletDropListIds);

  // Form and other properties
  secondFormGroup: FormGroup;
  currentDraggedProduct: UiProduct | null = null;

  // Weight and dimension calculations
  public totalWeight = this.store.selectSignal(selectTotalWeight);

  public remainingWeight = this.store.selectSignal(selectRemainingWeight);
  public totalMeter = this.store.selectSignal(selectTotalMeter);
  public remainingArea = this.store.selectSignal(selectRemainingArea);

  public heaviestPalletWeight = this.store.selectSignal(
    selectHeaviestPalletWeight
  );
  public lightestPalletWeight = this.store.selectSignal(
    selectLightestPalletWeight
  );
  public averagePalletWeight = this.store.selectSignal(
    selectAveragePalletWeight
  );

  // Pallet weight analytics
  constructor(private _formBuilder: FormBuilder) {
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadPallets();
    this.setupSearchSubscription();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
  }

  loadPallets(): void {
    this.repository.pallets().subscribe({
      next: (response) => {
        this.availablePallets.set(response);
      },
    });
  }

  packageTotalWeight(pkg: UiPackage): number {
    const palletWeight = Math.floor(pkg.pallet?.weight ?? 0);
    const productsWeight = pkg.products.reduce((total, product) => {
      if (!this.orderSignal()) {
        return 0;
      }
      if (this.orderSignal().weight_type == 'std') {
        return total + Math.floor(product.weight_type.std * product.count);
      } else if (this.orderSignal().weight_type == 'eco') {
        return total + Math.floor(product.weight_type.eco * product.count);
      } else {
        return total + Math.floor(product.weight_type.pre * product.count);
      }
    }, 0);

    return palletWeight + productsWeight;
  }

  // Dimension and fit checking methods
  canFitProductToPallet(
    product: UiProduct,
    pallet: UiPallet,
    existingProducts: UiProduct[]
  ): boolean {
    if (!this.checkDimensionsFit(product, pallet)) {
      return false;
    }
    return this.checkVolumeAvailable(product, pallet, existingProducts);
  }

  private checkDimensionsFit(product: UiProduct, pallet: UiPallet): boolean {
    if (!product?.dimension || !pallet?.dimension) {
      return false;
    }

    const safeProductWidth = this.safeNumber(product.dimension.width);
    const safeProductDepth = this.safeNumber(product.dimension.depth);
    const safeProductHeight = this.safeNumber(product.dimension.height);
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
    product: UiProduct,
    pallet: UiPallet,
    existingProducts: UiProduct[]
  ): boolean {
    if (!product?.dimension || !pallet?.dimension) {
      return false;
    }

    const palletTotalVolume =
      this.safeNumber(pallet.dimension.width) *
      this.safeNumber(pallet.dimension.depth) *
      this.safeNumber(pallet.dimension.height);

    const usedVolume = this.calculateUsedVolume(existingProducts);

    const newProductVolume =
      this.safeNumber(product.dimension.width) *
      this.safeNumber(product.dimension.depth) *
      this.safeNumber(product.dimension.height) *
      this.safeNumber(product.count);

    return newProductVolume <= palletTotalVolume - usedVolume;
  }

  private calculateUsedVolume(products: UiProduct[]): number {
    if (products.length === 0) return 0;

    return products.reduce((total, product) => {
      if (!product?.dimension) {
        return total;
      }
      const volume =
        this.safeNumber(product.dimension.width) *
        this.safeNumber(product.dimension.depth) *
        this.safeNumber(product.dimension.height) *
        this.safeNumber(product.count);
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
    existingProducts: UiProduct[]
  ): number {
    if (!pallet?.dimension) {
      return 0;
    }
    const palletTotalVolume =
      this.safeNumber(pallet.dimension.width) *
      this.safeNumber(pallet.dimension.depth) *
      this.safeNumber(pallet.dimension.height);
    const usedVolume = this.calculateUsedVolume(existingProducts);
    return Math.max(0, palletTotalVolume - usedVolume);
  }

  getPalletFillPercentage(
    pallet: UiPallet,
    existingProducts: UiProduct[]
  ): number {
    if (!pallet?.dimension) {
      return 0;
    }
    const palletTotalVolume =
      this.safeNumber(pallet.dimension.width) *
      this.safeNumber(pallet.dimension.depth) *
      this.safeNumber(pallet.dimension.height);
    const usedVolume = this.calculateUsedVolume(existingProducts);
    return Math.round((usedVolume / palletTotalVolume) * 100);
  }

  getMaxProductCount(
    product: UiProduct,
    pallet: UiPallet,
    existingProducts: UiProduct[]
  ): number {
    if (!product?.dimension || !pallet?.dimension) {
      return 0;
    }

    if (!this.checkDimensionsFit(product, pallet)) {
      return 0;
    }

    const remainingVolume = this.getRemainingPalletVolume(
      pallet,
      existingProducts
    );
    const singleProductVolume =
      this.safeNumber(product.dimension.width) *
      this.safeNumber(product.dimension.depth) *
      this.safeNumber(product.dimension.height);

    return Math.floor(remainingVolume / singleProductVolume);
  }

  updateProductCount(product: UiProduct, event: any): void {
    // Bu metodu sen doldur - product count güncellemesi için
    const newCount = parseInt(event.target.value);
    if (Number.isNaN(newCount) || newCount < 1) {
      // geçersiz inputu görmezden gel
      return;
    }
    this.store.dispatch(
      updateProductCountAndCreateOrUpdateOrderDetail({ product, newCount })
    );
  }

  selectProduct(product: any) {
    this.store.dispatch(updateProductCountAndCreateOrUpdateOrderDetail({ product: product, newCount: 0 }))
  }

  displayProductFn(product: any): string {
    return product ? product.name : '';
  }

  private setupSearchSubscription(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((value) => {
          if (typeof value === 'string' && value.length > 2) {
            this.isSearching = true;
            return this.productService.searchProducts(value, 10).pipe(
              catchError((error) => {
                return of([]);
              }),
              finalize(() => {
                this.isSearching = false;
              })
            );
          }
          return of([]);
        })
      )
      .subscribe({
        next: (products: any[]) => {
          this.filteredProducts.set(products);
        },
      });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.filteredProducts.set([])
    this.isSearching = false;
  }

  // Drag & Drop Event Handlers
  dropProductToPallet(event: CdkDragDrop<UiProduct[]>): void {
    if (event.previousContainer === event.container) {
      if (event.container.id === 'productsList') {
        this.store.dispatch(
          remainingProductMoveProduct({
            previousIndex: event.previousIndex,
            currentIndex: event.currentIndex,
          })
        );
      } else {
        this.store.dispatch(
          moveUiProductInSamePackage({
            currentIndex: event.currentIndex,
            previousIndex: event.previousIndex,
            containerId: event.container.id,
          })
        );
      }
      return;
    }

    // Paletten available products'a geri alma
    if (event.container.id === 'productsList') {
      this.store.dispatch(
        moveProductToRemainingProducts({
          uiProducts: event.previousContainer.data,
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
    const product = event.previousContainer.data[event.previousIndex];

    if (isSourceFromPallet) {
      // Palet-to-palet transfer
      const sourcePackage = currentPackages.find(
        (pkg) => pkg.pallet && pkg.pallet.ui_id === event.previousContainer.id
      );

      if (sourcePackage) {
        // Sığma kontrolü
        if (targetPackage.pallet) {
          const canFit = this.canFitProductToPallet(
            product,
            targetPackage.pallet,
            targetPackage.products
          );
          if (!canFit) {
            const fillPercentage = this.getPalletFillPercentage(
              targetPackage.pallet,
              targetPackage.products
            );
            this.toastService.error(
              `Ürün bu palete sığmıyor. Palet doluluk: %${fillPercentage}`,
              'Boyut Hatası'
            );
            return;
          }
        }
        this.store.dispatch(
          moveUiProductInPackageToPackage({
            sourcePackage: sourcePackage,
            targetPackage: targetPackage,
            previousIndex: event.previousIndex,
          })
        );
        return;
      }
    }

    // Available products'tan palete transfer
    if (targetPackage.pallet) {
      const canFit = this.canFitProductToPallet(
        product,
        targetPackage.pallet,
        targetPackage.products
      );
      if (!canFit) {
        const fillPercentage = this.getPalletFillPercentage(
          targetPackage.pallet,
          targetPackage.products
        );
        this.toastService.error(
          `Ürün bu palete sığmıyor. Palet doluluk: %${fillPercentage}`,
          'Boyut Hatası'
        );
        return;
      }
    }
    this.store.dispatch(
      moveRemainingProductToPackage({
        targetPackage: targetPackage,
        previousIndex: event.previousIndex,
      })
    );
    return;
  }

  dropPalletToPackage(event: CdkDragDrop<any>): void {
    if (event.previousContainer === event.container) return;
    this.store.dispatch(
      movePalletToPackage({
        containerId: event.container.id,
        previousIndex: event.previousIndex,
        previousContainerData: event.previousContainer.data,
      })
    );
  }

  dragStarted(event: CdkDragStart): void {
    const product = event.source.data as UiProduct;

    this.currentDraggedProduct = product;

    const palletElements = new Map<string, HTMLElement>();

    if (!product?.dimension) {
      this.toastService.error('Ürün boyut bilgisi eksik');
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
        const canFit = this.canFitProductToPallet(
          product,
          pkg.pallet,
          pkg.products
        );
        const palletElement = palletElements.get(pkg.pallet.ui_id);

        if (palletElement) {
          if (canFit) {
            palletElement.classList.add('can-drop');
            palletElement.classList.remove('cannot-drop');

            const maxCount = this.getMaxProductCount(
              product,
              pkg.pallet,
              pkg.products
            );
            palletElement.title = `✅ Bu palete maksimum ${maxCount} adet sığabilir`;
          } else {
            palletElement.classList.add('cannot-drop');
            palletElement.classList.remove('can-drop');

            const fillPercentage = this.getPalletFillPercentage(
              pkg.pallet,
              pkg.products
            );
            const singleVolume =
              this.safeNumber(product.dimension.width) *
              this.safeNumber(product.dimension.depth) *
              this.safeNumber(product.dimension.height);
            const remainingVolume = this.getRemainingPalletVolume(
              pkg.pallet,
              pkg.products
            );
            const maxCount = Math.floor(remainingVolume / singleVolume);

            if (maxCount > 0) {
              palletElement.title = `⚠️ Sadece ${maxCount} adet sığar (Doluluk: %${fillPercentage})`;
            } else {
              palletElement.title = `❌ Sığmaz - Palet doluluk: %${fillPercentage}`;
            }
          }
        }
      }
    });
  }

  dragEnded(): void {
    this.currentDraggedProduct = null;

    document.querySelectorAll('.can-drop, .cannot-drop').forEach((el) => {
      el.classList.remove('can-drop', 'cannot-drop');
    });
  }

  // Product manipulation methods
  splitProduct(product: UiProduct, splitCount?: number | null): void {
    this.store.dispatch(
      splitProduct({ product: product, splitCount: splitCount ?? null })
    );
  }

  removeProductFromPackage(pkg: UiPackage, productIndex: number): void {
    this.store.dispatch(
      removeProductFromPackage({
        pkg: pkg,
        productIndex: productIndex,
      })
    );
  }

  removeAllPackage(): void {
    this.store.dispatch(removeAllPackage());
  }

  removePackage(packageToRemove: any): void {
    this.store.dispatch(removePackage({ packageToRemove: packageToRemove }));
  }

  removePalletFromPackage(packageItem: UiPackage): void {
    this.store.dispatch(
      removePalletFromPackage({
        pkg: packageItem,
      })
    );
  }

  calculatePackageDetail() {
    if (this.orderDetailsIsDirtySignal())
      this.store.dispatch(updateOrderDetailsChanges({ context: "calculatePackageDetails" }))
    else {
      this.store.dispatch(calculatePackageDetail())
    }
  }

  addUiProduct(product: UiProduct) {
    this.store.dispatch(addUiProductToRemainingProducts({ product: product }));
  }

  deleteRemainingProduct(product: UiProduct): void {
    this.store.dispatch(deleteRemainingProduct({ product: product }));
  }

  submitForm(): void {
    if (this.isDirtySignal()) {
      this.store.dispatch(palletControlSubmit());
    }
  }
}
