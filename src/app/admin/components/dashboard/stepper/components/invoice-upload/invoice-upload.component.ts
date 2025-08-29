// invoice-upload.component.ts (Refactored)

import {
  Component,
  inject,
  OnInit,
  ViewChild,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed
} from '@angular/core';
import { FormGroup } from '@angular/forms';
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
  finalize,
  Subscription,
  concat,
  of,
} from 'rxjs';
import { OrderService } from '../../../../services/order.service';
import { ToastService } from '../../../../../../services/toast.service';
import { LocalStorageService } from '../../services/local-storage.service';

import { OrderDetail } from '../../../../../../models/order-detail.interface';
import { ExternalDataParams, GenericTableComponent } from '../../../../../../components/generic-table/generic-table.component';

// Refactored managers and services
import { FileUploadManager } from './managers/file-upload.manager';
import { OrderFormManager } from './managers/order-form.manager';
import { OrderDetailManager } from './managers/order-detail.manager';
import { UIStateManager } from './managers/ui-state.manager';
import { InvoiceDataLoaderService } from './services/invoice-data-loader.service';
import { InvoiceCalculatorService } from './services/invoice-calculator.service';

import * as StepperSelectors from '../../../../../../store/stepper/stepper.selectors';
import * as StepperActions from '../../../../../../store/stepper/stepper.actions';
// Types and constants
import {
  OrderDetailUpdateEvent,
  UIState,
  ReferenceData,
  WeightType,
} from './models/invoice-upload-interfaces';
import { INVOICE_UPLOAD_CONSTANTS } from './constants/invoice-upload.constants';
import { AppState } from '../../../../../../store';
import { Store } from '@ngrx/store';

import {
  selectOrder, selectStep1OrderDetails, selectStep1IsDirty,
  selectStep1HasFile, selectStep1FileName
} from '../../../../../../store/stepper/stepper.selectors';
import { CompanyRelation } from '../../../../../../models/company-relation.interface';
import { Truck } from '../../../../../../models/truck.interface';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

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
    MatNativeDateModule,
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

  // Original services still needed
  private readonly toastService = inject(ToastService);

  private readonly store = inject(Store<AppState>);
  // NgRx Step1 Migration Observables
  public orderSignal = this.store.selectSignal(selectOrder);
  public orderDetailsSignal = this.store.selectSignal(selectStep1OrderDetails);
  public isDirtySignal = this.store.selectSignal(selectStep1IsDirty);
  public hasUploadFileSignal = this.store.selectSignal(selectStep1HasFile);
  public fileNameSignal = this.store.selectSignal(selectStep1FileName);
  public isLoadingSignal = this.store.selectSignal(StepperSelectors.selectIsStepLoading(1));
  public isEditModeSignal = this.store.selectSignal(StepperSelectors.selectIsEditMode);




  public step1OrderDetails$ = this.store.select(selectStep1OrderDetails);
  public step1IsDirty$ = this.store.select(selectStep1IsDirty);
  public step1HasFile$ = this.store.select(selectStep1HasFile);
  public step1FileName$ = this.store.select(selectStep1FileName);

  // NgRx Observables
  public isEditMode$ = this.store.select(StepperSelectors.selectIsEditMode);

  private readonly cdr = inject(ChangeDetectorRef);
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
    this.store.select(StepperSelectors.selectIsStepLoading(0)),
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

  get filterableColumns(): string[] {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.FILTERABLE_COLUMNS as string[];
  }

  get nestedDisplayColumns(): { [key: string]: string } {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.NESTED_DISPLAY_COLUMNS;
  }

  get excludeFields(): string[] {
    return INVOICE_UPLOAD_CONSTANTS.TABLE.EXCLUDE_FIELDS as string[];
  }


  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
    this.autoSaveSubscription?.unsubscribe();
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
    }
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
    console.log("delete order detail id invoice upload", id)
    this.store.dispatch(StepperActions.deleteOrderDetail({
      orderDetailId: id
    }));

  }

  public totalWeight = computed(() => {
    if (!this.orderSignal()?.weight_type) {
      return 0;
    }
    console.log("total weight", this.orderSignal(), this.orderDetailsSignal())
    const total = this.calculatorService.calculateTotalWeight(
      this.orderDetailsSignal(),
      this.orderSignal()?.weight_type as WeightType
    )
    console.log("total weight", total)
    return total.totalWeight;
  })


  isFormValid(): boolean {
    let hasValidOrderDetails = this.orderDetailsSignal().length > 0;
    let hasValidOrder = !!(this.orderSignal()?.date && this.orderSignal()?.company_relation && this.orderSignal()?.truck && this.orderSignal()?.weight_type);
    return hasValidOrder && hasValidOrderDetails;
  }

  submit(): void {
    if (!this.isFormValid()) {
      this.toastService.warning(INVOICE_UPLOAD_CONSTANTS.MESSAGES.WARNING.FILL_REQUIRED_FIELDS);
      return;
    }

    if (!this.orderSignal() || this.orderDetailsSignal().length === 0) {
      this.toastService.warning(INVOICE_UPLOAD_CONSTANTS.MESSAGES.WARNING.MISSING_ORDER_DETAILS);
      return;
    }

    this.store.dispatch(StepperActions.invoiceUploadSubmitFlow())


    // this.store.dispatch(StepperActions.updateOrCreateOrder({
    //   orderId: this.orderSignal()?.id
    // }
    // ))
    // setTimeout(() => {
    // this.store.dispatch(StepperActions.createOrderDetails())
    // }, 5000);
    // setTimeout(() => {
    //  this.store.dispatch(StepperActions.uploadInvoiceFile())
    // }, 4000);
  }

  resetForm(): void {
    this.fileUploadManager.moveFileToTemp();
    this.orderFormManager.resetForm();
  }

  resetComponentState(): void {
    try {
      this.store.dispatch(StepperActions.initializeStep1State({
        order: null,
        orderDetails: [],
        hasFile: false,
        fileName: undefined
      }));
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
    return true
  })


  private syncComponentWithBackendData(backendOrderDetails: OrderDetail[]): void {
    this.store.dispatch(StepperActions.syncStep1WithBackend({
      orderDetails: backendOrderDetails
    }));
  }

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
}
