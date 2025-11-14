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
  calculatePackageDetail,
  setRemainingProducts,
  mergeRemainingProducts,
  movePartialProductBetweenPackages,
  movePartialRemainingProductToPackage,
  setVerticalSort,
  navigateToStep,
  setVerticalSortInPackage,
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
  selectVerticalSort,
  selectUiPallets,
} from '../../../../../store/stepper/stepper.selectors';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../../services/product.service';
import {
  MatAutocompleteModule,
} from '@angular/material/autocomplete';
import { MatOption } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CancelConfirmationDialogComponent } from '../../../../../components/cancel-confirmation-dialog/cancel-confirmation-dialog.component';
import { MatDialog } from '@angular/material/dialog';

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
    MatAutocompleteModule,
    MatTooltipModule,
    MatCheckboxModule,
  ],
  templateUrl: './pallet-control.component.html',
  styleUrl: './pallet-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PalletControlComponent
  implements OnInit, AfterViewInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
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

  public orderDetailsIsDirtySignal =
    this.store.selectSignal(selectStep1IsDirty);

  public isDirtySignal = this.store.selectSignal(selectStep2IsDirty);
  public orderSignal = this.store.selectSignal(selectOrder);
  public verticalSortSignal = this.store.selectSignal(selectVerticalSort);

  private autoSaveTimeout: any;
  private destroy$ = new Subject<void>();

  public availablePallets = this.store.selectSignal(selectUiPallets);

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

  //Sorting Process
  sortAscending = signal<boolean>(false);

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

  //Sorting css optimize process
  toggleSort() {
    this.sortAscending.set(!this.sortAscending());
    const multiplier = this.sortAscending() ? 1 : -1;

    const remainingProducts = [...this.remainingProducts()].sort((a, b) => {
      return multiplier * (
        (b.dimension.depth - a.dimension.depth) ||      // Önce depth (büyükten küçüğe)
        (b.dimension.width - a.dimension.width) ||      // Sonra width (büyükten küçüğe)
        (b.dimension.height - a.dimension.height) ||    // Sonra height (büyükten küçüğe)
        (b.count - a.count)                             // Son olarak count (büyükten küçüğe)
      );
    });

    this.store.dispatch(setRemainingProducts({ remainingProducts }));
  }

  //merge remaining products process
  merge() {
    this.store.dispatch(mergeRemainingProducts())
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
    this.store.dispatch(
      updateProductCountAndCreateOrUpdateOrderDetail({
        product: product,
        newCount: 0,
      })
    );
    // Seçimden sonra aramayı temizle (opsiyonel)
    this.clearSearch();
  }

  displayProductFn(product: any): string {
    return product ? product.name : '';
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
        next: (products: any[]) => {
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
      const sourcePackage = currentPackages.find(
        (pkg) => pkg.pallet && pkg.pallet.ui_id === event.previousContainer.id
      );

      if (sourcePackage) {
        // Sığma kontrolü
        if (targetPackage.pallet) {
          const fitResult = this.calculateMaxFitCount(
            product,
            targetPackage.pallet,
            targetPackage.products
          );

          if (fitResult.maxCount === 0) {
            // Hiç sığmıyor
            const fillPercentage = this.getPalletFillPercentage(
              targetPackage.pallet,
              targetPackage.products
            );
            this.toastService.error(
              `Ürün bu palete sığmıyor. Palet doluluk: %${fillPercentage}`,
              'Boyut Hatası'
            );
            return;
          } else if (fitResult.maxCount < product.count) {
            // Kısmi sığıyor - YENİ DURUM
            this.toastService.warning(
              `${product.count} adetten ${fitResult.maxCount} tanesi palete eklendi`,
              'Kısmi Transfer'
            );
            this.store.dispatch(
              movePartialProductBetweenPackages({
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
          moveUiProductInPackageToPackage({
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
        product,
        targetPackage.pallet,
        targetPackage.products
      );
      if (fitResult.maxCount === 0) {
        // Hiç sığmıyor
        const fillPercentage = this.getPalletFillPercentage(
          targetPackage.pallet,
          targetPackage.products
        );
        this.toastService.error(
          `Ürün bu palete sığmıyor. Palet doluluk: %${fillPercentage}`,
          'Boyut Hatası'
        );
        return;
      } else if (fitResult.maxCount < product.count) {
        // Kısmi sığıyor
        this.toastService.warning(
          `${product.count} adetten ${fitResult.maxCount} tanesi palete eklendi`,
          'Kısmi Transfer'
        );
        this.store.dispatch(
          movePartialRemainingProductToPackage({
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
      moveRemainingProductToPackage({
        targetPackageId: targetPackage.id,
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
        const fitResult = this.calculateMaxFitCount(
          product,
          pkg.pallet,
          pkg.products
        );
        const palletElement = palletElements.get(pkg.pallet.ui_id);

        if (palletElement) {
          if (fitResult.maxCount === 0) {
            // Hiç sığmıyor - KIRMIZI
            palletElement.classList.add('cannot-drop');
            palletElement.classList.remove('can-drop', 'partial-drop');

            const fillPercentage = this.getPalletFillPercentage(pkg.pallet, pkg.products);
            palletElement.title = `❌ Sığmaz - Palet doluluk: %${fillPercentage}`;

          } else if (fitResult.maxCount < product.count) {
            // Kısmi sığıyor
            palletElement.classList.add('partial-drop');
            palletElement.classList.remove('can-drop', 'cannot-drop');

            const fillPercentage = this.getPalletFillPercentage(pkg.pallet, pkg.products);
            palletElement.title = `⚠️ Sadece ${fitResult.maxCount} adet sığar (${product.count} adetten) - Doluluk: %${fillPercentage}`;

          } else {
            // Tamamen sığıyor - YEŞİL
            palletElement.classList.add('can-drop');
            palletElement.classList.remove('cannot-drop', 'partial-drop');

            palletElement.title = `✅ Bu palete maksimum ${fitResult.maxCount} adet sığabilir`;
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

  calculateMaxFitCount(product: UiProduct, pallet: UiPallet, existingProducts: UiProduct[]): { canFit: boolean; maxCount: number } {
    // Tek bir ürünün boyutsal olarak sığıp sığmadığını kontrol et
    const singleProductCanFit = this.canFitProductToPallet(
      {
        ...product, count: 1,
        split: function (perItem?: number | null): UiProduct[] {
          throw new Error('Function not implemented.');
        }
      },
      pallet,
      existingProducts
    );

    if (!singleProductCanFit) {
      return { canFit: false, maxCount: 0 };
    }

    // Palet kapasitesi
    const palletCapacity =
      pallet.dimension.depth * pallet.dimension.width * pallet.dimension.height;

    // Mevcut ürünlerin toplam hacmi
    const usedVolume = existingProducts.reduce((total, p) => {
      const productVolume =
        p.dimension.depth * p.dimension.width * p.dimension.height;
      return total + productVolume * p.count;
    }, 0);

    // Kalan hacim
    const remainingVolume = palletCapacity - usedVolume;

    // Bir adet ürünün hacmi
    const productVolume =
      product.dimension.depth *
      product.dimension.width *
      product.dimension.height;

    // Maksimum kaç adet sığabilir
    const maxCount = Math.floor(remainingVolume / productVolume);

    // Product count'tan fazla olamaz
    const finalMaxCount = Math.min(maxCount, product.count);

    return {
      canFit: true,
      maxCount: finalMaxCount,
    };
  }

  // Product manipulation methods
  splitProduct(productUiId: string, splitCount?: number | null): void {
    this.store.dispatch(
      splitProduct({ productUiId: productUiId, splitCount: splitCount ?? null })
    );
  }

  removeProductFromPackage(pkgId: string, productIndex: number): void {
    this.store.dispatch(
      removeProductFromPackage({
        pkgId: pkgId,
        productIndex: productIndex,
      })
    );
  }

  removeAllPackage(): void {
    this.store.dispatch(removeAllPackage());
  }

  removePackage(packageToRemove: any): void {
    this.store.dispatch(removePackage({ packageId: packageToRemove.id }));
  }

  removePalletFromPackage(packageItem: UiPackage): void {
    this.store.dispatch(
      removePalletFromPackage({
        pkgId: packageItem.id,
      })
    );
  }

  onVerticalSortChange(value: boolean): void {
    this.store.dispatch(setVerticalSort({ verticalSort: value }));
  }

  calculatePackageDetail() {
    if (this.orderDetailsIsDirtySignal())
      this.store.dispatch(
        updateOrderDetailsChanges({ context: 'calculatePackageDetails' })
      );
    else {
      this.store.dispatch(calculatePackageDetail());
    }
  }

  toggleAlignment(_package: any): void {
    _package.alignment = _package.alignment === 'v' ? 'h' : 'v';
    this.store.dispatch(setVerticalSortInPackage({pkgId: _package.id,alignment:_package.alignment}))
  }

  addUiProduct(productUiId: string) {
    this.store.dispatch(addUiProductToRemainingProducts({ productUiId: productUiId }));
  }

  deleteRemainingProduct(productUiId: string): void {
    this.store.dispatch(deleteRemainingProduct({ productUiId: productUiId }));
  }


  submitForm(): void {
    if (this.remainingProductCount() > 0) {
      const dialogRef = this.dialog.open(CancelConfirmationDialogComponent, {
        width: '400px',
        maxWidth: '95vw',
        disableClose: true,
        panelClass: 'cancel-confirmation-dialog',
        data: {
          header: "Yerleştirilmeyen  Ürünler Var!",
          title: "Kalan ürünleri yerleştirmeniz gerekmektedir",
          info: "Eğer bu şekide devam etmek isterseniz yerleştirilmeyen ürünler siparişten kaldırılacaktır.",
          confirmButtonText: "Yine de devam et."
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result === true) {
          this.remainingProducts().forEach(product => this.deleteRemainingProduct(product.ui_id))
          this.submitForm()
        } else {
          return;
        }

      });
    }
    else if (this.isDirtySignal()) {
      this.store.dispatch(palletControlSubmit());
    } else {
      this.store.dispatch(navigateToStep({ stepIndex: 2 }))
    }
  }

  goPreviousStep() {
    this.store.dispatch(navigateToStep({ stepIndex: 0 }))
  }

}
