import {
  Component,
  inject,
  OnInit,
  ViewChild,
  OnDestroy,
  ChangeDetectionStrategy,
  computed,
  effect
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  Observable,
  Subject,
  Subscription,
} from 'rxjs';
import { ToastService } from '../../../../../services/toast.service';

import { GenericTableComponent } from '../../../../../components/generic-table/generic-table.component';

// Refactored managers and services
import { FileUploadManager } from './managers/file-upload.manager';
import { OrderFormManager } from './managers/order-form.manager';
import { OrderDetailManager } from './managers/order-detail.manager';
import { UIStateManager } from './managers/ui-state.manager';
import { InvoiceDataLoaderService } from './services/invoice-data-loader.service';
import { InvoiceCalculatorService } from './services/invoice-calculator.service';

import * as StepperActions from '../../../../../store/stepper/stepper.actions';
// Types and constants
import {
  OrderDetailUpdateEvent,
  UIState,
  ReferenceData,
  WeightType,
} from './models/invoice-upload-interfaces';
import { INVOICE_UPLOAD_CONSTANTS } from './constants/invoice-upload.constants';
import { AppState, selectUser, setTemplateFile } from '../../../../../store';
import { Store } from '@ngrx/store';
import {
  selectOrder, selectStep1OrderDetails, selectStep1IsDirty,
  selectStep1HasFile, selectStep1FileName,
  selectAverageOrderDetailHeight, selectIsStepLoading, selectIsEditMode,
  selectIsOnlyOrderDirty,
  selectInvoiceTemplateFile,
} from '../../../../../store/stepper/stepper.selectors';
import { CompanyRelation } from '../../../../../models/company-relation.interface';
import { Truck } from '../../../../../models/truck.interface';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CompanyRelationService } from '../../../services/company-relation.service';
import { FileService } from '../../../services/file.service';

@Component({
  selector: 'app-invoice-upload',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatStepperModule,
    MatButtonModule,
    MatTableModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDialogModule,
    MatDividerModule,
    MatCardModule,
    MatTooltipModule,
    GenericTableComponent,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './invoice-upload.component.html',
  styleUrl: './invoice-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoiceUploadComponent implements OnInit, OnDestroy {
  @ViewChild(GenericTableComponent) genericTable!: GenericTableComponent<any>;

  // Inject managers and services
  private readonly fileUploadManager = inject(FileUploadManager);
  private readonly orderFormManager = inject(OrderFormManager);
  private readonly orderDetailManager = inject(OrderDetailManager);
  private readonly uiStateManager = inject(UIStateManager);
  private readonly dataLoaderService = inject(InvoiceDataLoaderService);
  private readonly calculatorService = inject(InvoiceCalculatorService);
  private readonly companyRelationService = inject(CompanyRelationService);
  private readonly fileService = inject(FileService)
  // Original services still needed
  private readonly toastService = inject(ToastService);

  private readonly store = inject(Store<AppState>);
  // NgRx Step1 Migration Observables
  public orderSignal = this.store.selectSignal(selectOrder);
  public orderDetailsSignal = this.store.selectSignal(selectStep1OrderDetails);
  public isDirtySignal = this.store.selectSignal(selectStep1IsDirty);
  public isOnlyOrderDirtySignal = this.store.selectSignal(selectIsOnlyOrderDirty);

  public hasUploadFileSignal = this.store.selectSignal(selectStep1HasFile);
  public fileNameSignal = this.store.selectSignal(selectStep1FileName);
  public isLoadingSignal = this.store.selectSignal(selectIsStepLoading(1));
  public isEditModeSignal = this.store.selectSignal(selectIsEditMode);
  public userSignal = this.store.selectSignal(selectUser);
  public templateFileSignal = this.store.selectSignal(selectInvoiceTemplateFile);

  private readonly unitProductHeight = this.store.selectSignal(selectAverageOrderDetailHeight)
  unitsControl = new FormControl(20);
  private destroy$ = new Subject<void>();

  public step1OrderDetails$ = this.store.select(selectStep1OrderDetails);
  public step1HasFile$ = this.store.select(selectStep1HasFile);

  // NgRx Observables
  public isEditMode$ = this.store.select(selectIsEditMode);

  // Form and data
  uploadForm!: FormGroup;
  referenceData: ReferenceData = { targetCompanies: [], trucks: [] };
  processingLock: boolean = true;

  // Subscriptions
  private subscriptions: Subscription[] = [];
  private autoSaveSubscription?: Subscription;

  // Expose constants for template
  readonly constants = INVOICE_UPLOAD_CONSTANTS;

  // Getters for template access


  get uiState$(): Observable<UIState> {
    return this.uiStateManager.uiState$;
  }

  // UI State getters
  isLoading$ = combineLatest([
    this.store.select(selectIsStepLoading(0)),
    this.uiState$
  ]).pipe(
    map(([ngrxLoading, uiLoading]) => ngrxLoading || uiLoading)
  );

  get file(): File | null {
    return this.fileUploadManager.getCurrentFile();
  }

  get tempFile(): File | null {
    return this.fileUploadManager.getTempFile();
  }

  // Reference data getters
  get targetCompanies(): any[] {
    return this.referenceData.targetCompanies;
  }

  get trucks(): any[] {
    return this.referenceData.trucks;
  }

  // Table configuration getters
  get displayedColumns(): string[] {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.DISPLAYED_COLUMNS as string[];
  }

  get columnTypes(): { [key: string]: string } {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.COLUMN_TYPES as { [key: string]: string };
  }

  get filterableColumns(): string[] {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.FILTERABLE_COLUMNS as string[];
  }

  get nestedDisplayColumns(): { [key: string]: string } {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.NESTED_DISPLAY_COLUMNS;
  }

  get excludeFields(): string[] {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.EXCLUDE_FIELDS as string[];
  }


  constructor() {

    // ValueChanges subscription'ı

  }

  ngOnInit(): void {
    this.initializeComponent();
    this.getTemplateFile();
    effect(() => {
      const order = this.orderSignal();
      if (!order) return;

      const palletHeight = order.max_pallet_height;
      const unitProductHeight = this.unitProductHeight();
      if (!unitProductHeight) return;

      const unitProductCount = palletHeight / unitProductHeight;
      this.unitsControl.setValue(unitProductCount, { emitEvent: false });
    });
    // this.unitsControl.valueChanges.pipe(
    //   debounceTime(300),
    //   distinctUntilChanged(),
    //   takeUntil(this.destroy$)
    // ).subscribe(units => {
    //   if (units !== null && units !== undefined && units > 0) {
    //     const newHeight = units * this.unitProductHeight();
    //     this.onMaxPalletHeightChange(newHeight);
    //   }
    // });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.autoSaveSubscription?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    this.uploadForm = this.orderFormManager.initializeForm();
    this.setupUIStateSubscription();
    this.loadReferenceData();
  }

  private setupUIStateSubscription(): void {
    const uiSub = this.uiState$.subscribe(state => {
    });
    this.subscriptions.push(uiSub);
  }

  private loadReferenceData(): void {
    const dataSub = this.dataLoaderService.loadAllReferenceData().subscribe({
      next: (data) => {
        this.referenceData = data;
      }
    });
    this.subscriptions.push(dataSub);
  }

  downloadTemplate() {
    const templateFile = this.templateFileSignal();
    if (templateFile) {
      const file = templateFile;

      // HTTP ile dosyayı blob olarak indir
      fetch(file.file)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${file.name}.xlsx`;
          document.body.appendChild(link);
          link.click();

          // Temizlik
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Dosya indirme hatası:', error);
          // Hata bildirimi göster
        });
    } else {
      console.warn('Template dosyası bulunamadı');
    }
  }

  getTemplateFile() {
    if (!this.templateFileSignal() || this.templateFileSignal().length === 0) {
      const company_id = this.userSignal()?.company.id
      this.fileService.getAll({
        company_id: company_id,
        type: 'isb_template'
      }).subscribe(response => {
        this.store.dispatch(setTemplateFile({ templateFile: response.results[0] }))
      })
    }
  }

  onFileSelected(event: Event): void {
    this.fileUploadManager.selectFile(event);
    this.uploadFile();
  }

  uploadFile(): void {
    this.store.dispatch(StepperActions.setStepLoading({
      stepIndex: 0,
      loading: true,
      operation: 'File upload'
    }));
    this.store.dispatch(StepperActions.uploadInvoiceProcessFile());
    this.resetForm();

  }

  onOrderFieldChange(field: string, value: any): void {
    let currentOrder = this.orderSignal();
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, [field]: value };
      this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }));
    }
  }

  onCompanyChange(selectedCompany: any): void {
    let currentOrder = this.orderSignal();
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, company_relation: selectedCompany };
      this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }));
      this.store.dispatch(StepperActions.updateOrCreateOrder({ context: 'companyRelationUpdated' }))

      // ✅ Settings'i al ve order'ı güncelle
      if (selectedCompany?.id) {
        this.loadCompanyRelationSettings(selectedCompany.id);
      }
    }
  }

  /**
  * Company Relation settings'ini yükle ve order'ı güncelle
  */
  private loadCompanyRelationSettings(relationId: string): void {
    this.companyRelationService.getSettings(relationId).subscribe({
      next: (settings) => {
        let currentOrder = this.orderSignal();
        if (currentOrder) {
          const palletHeight = settings.max_pallet_height;
          const unitProductHeight = this.unitProductHeight();
          const unitProductCount = palletHeight / unitProductHeight;
          this.unitsControl.setValue(unitProductCount);
          // Order'ı settings ile güncelle
          const updatedOrder = {
            ...currentOrder,
            truck_weight_limit: settings.truck_weight_limit,
            max_pallet_height: settings.max_pallet_height,
            weight_type: settings.weight_type
          };

          this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }));

          // Paletleri de güncelle (relation değişti)
          // this.repositoryService.getPalletsByCompanyRelation(relationId);
        }
      },
      error: (error) => {
        console.error('Settings yüklenirken hata:', error);
        // Hata durumunda default değerleri kullan (zaten order'da var)
      }
    });
  }

  onTruckChange(selectedTruck: any): void {
    let currentOrder = this.orderSignal();
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, truck: selectedTruck };
      this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }));
    }
  }

  onWeightTypeChange(selectedWeightType: string): void {
    let currentOrder = this.orderSignal();
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, weight_type: selectedWeightType };
      this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }))
    }
  }

  // Display units artık FormControl'den gelir
  displayUnits = computed(() => {
    return this.unitsControl.value || 1;
  });

  // Minimum units kontrolü
  isMinimumUnits = computed(() => this.displayUnits() <= 1);

  // + butonu için
  onUnitsIncrease(): void {
    const currentValue = this.unitsControl.value || 1;
    const newValue = currentValue + 1;
    this.unitsControl.setValue(newValue);

    // Direkt çağır
    const newHeight = newValue * this.unitProductHeight();
    this.onMaxPalletHeightChange(newHeight);
  }

  // - butonu için
  onUnitsDecrease(): void {
    const currentValue = this.unitsControl.value || 1;
    if (currentValue > 1) {
      const newValue = currentValue - 1;
      this.unitsControl.setValue(newValue);

      const newHeight = newValue * this.unitProductHeight();
      this.onMaxPalletHeightChange(newHeight);
    }
  }

  // Mevcut metod aynı kalır
  onMaxPalletHeightChange(maxPalletHeight: number): void {
    let currentOrder = this.orderSignal();
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, max_pallet_height: maxPalletHeight };
      this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }));
    }
  }

  onTruckWeightLimitChange(value: number): void {
    let currentOrder = this.orderSignal();
    if (currentOrder) {
      const updatedOrder = { ...currentOrder, truck_weight_limit: value };
      this.store.dispatch(StepperActions.setOrder({ order: updatedOrder }));
    }
  }

  createOrder(): void {
    const now = new Date();
    const newOrder = {
      id: crypto.randomUUID(),
      name: '',
      date: now.toISOString(),
      company_relation: {} as CompanyRelation,
      truck: {} as Truck,
      weight_type: '',
      created_at: now,
      updated_at: now,
      deleted_time: null,
      is_deleted: false,
    };
    this.store.dispatch(StepperActions.setOrder({ order: newOrder }))
    this.openOrderDetailAddDialog();
  }

  openOrderDetailAddDialog() {
    const dialogSub = this.orderDetailManager.openOrderDetailDialog()
      .subscribe({
        next: (orderDetail: any) => {
          if (orderDetail) {
            this.store.dispatch(StepperActions.addOrderDetail({
              orderDetail: orderDetail
            }));

          }
        }
      });

    this.subscriptions.push(dialogSub);
  }

  updateOrderDetail(event: OrderDetailUpdateEvent): void {
    const updatedDetail = { ...event.item, ...event.data };
    this.store.dispatch(StepperActions.updateOrderDetail({
      orderDetail: updatedDetail
    }));
  }

  deleteOrderDetail(id: string): void {
    this.store.dispatch(StepperActions.deleteOrderDetail({
      orderDetailId: id
    }));

  }

  public totalWeight = computed(() => {
    if (!this.orderSignal()?.weight_type) {
      return 0;
    }
    const total = this.calculatorService.calculateTotalWeight(
      this.orderDetailsSignal(),
      this.orderSignal()?.weight_type as WeightType
    )
    return total.totalWeight;
  })


  isFormValid(): boolean {
    let hasValidOrderDetails = this.orderDetailsSignal().length > 0;
    let hasValidOrder = !!(this.orderSignal()?.date && this.orderSignal()?.company_relation && this.orderSignal()?.truck && this.orderSignal()?.weight_type);
    return hasValidOrder && hasValidOrderDetails;
  }

  submit(): void {
    // eger is diry ise
    //  eger isonlyorderdiry ise
    //    update or create order
    //
    if (!this.isDirtySignal()) {
      if (this.isOnlyOrderDirtySignal()) {
        this.store.dispatch(StepperActions.updateOrCreateOrder({ context: 'order' }))
      }
      this.store.dispatch(StepperActions.navigateToStep({ stepIndex: 1 }));
      return;
    } if (!this.isFormValid()) {
      this.toastService.warning(INVOICE_UPLOAD_CONSTANTS.MESSAGES.WARNING.FILL_REQUIRED_FIELDS);
      return;
    }

    if (!this.orderSignal() || this.orderDetailsSignal().length === 0) {
      this.toastService.warning(INVOICE_UPLOAD_CONSTANTS.MESSAGES.WARNING.MISSING_ORDER_DETAILS);
      return;
    }

    this.store.dispatch(StepperActions.invoiceUploadSubmitFlow())
  }

  resetForm(): void {
    this.fileUploadManager.moveFileToTemp();
    this.orderFormManager.resetForm();
  }

  resetComponentState(): void {
    try {
      this.store.dispatch(StepperActions.resetStep1State());
      this.fileUploadManager.resetAllFiles();

      this.uiStateManager.resetAllStates();
    } catch (error) {

    }
  }


  updateTableData1 = computed(() => {
    if (this.genericTable?.dataSource) {
      this.genericTable.dataSource.data = [...this.orderDetailsSignal()];
      this.genericTable.dataSource._updateChangeSubscription();
    }
    return true;
  })


  getFormattedDate(date: string | Date | null | undefined): string {
    return this.orderFormManager.getFormattedDate(date);
  }

  compareObjects = (a: any, b: any): boolean => {
    return this.orderFormManager.compareObjects(a, b);
  }

  compareCompanies = (a: any, b: any): boolean => {
    return this.orderFormManager.compareCompanies(a, b);
  }

  compareWeightTypes = (a: string, b: string): boolean => {
    return this.orderFormManager.compareWeightTypes(a, b);
  }

  getTotalCount(): number {
    if (!this.orderDetailsSignal() || !this.orderDetailsSignal().length) {
      return 0;
    }

    return this.orderDetailsSignal().reduce((total: number, detail: any) => {
      const count = detail.count || 0;
      return (total + count)
    }, 0);
  }

  getTotalMeter(): number {
    if (!this.orderDetailsSignal() || !this.orderDetailsSignal().length) {
      return 0;
    }

    return this.orderDetailsSignal().reduce((total: number, detail: any) => {
      const depth = detail.product?.dimension?.depth || 0;
      const count = detail.count || 0;
      return (total + (depth * count) / 1000)
    }, 0);
  }
}
