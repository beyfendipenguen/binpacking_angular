import { IUiPackage } from '@app/features/stepper/interfaces/ui-interfaces/ui-package.interface';
import { IUiPallet } from '@app/features/stepper/interfaces/ui-interfaces/ui-pallet.interface';
import { createAction, props } from '@ngrx/store';


export const calculateOrderDetailChanges = createAction(
  '[Stepper] Calculate Order Detail Changes'
);
/**
 * Package değişikliklerini hesaplama action'ı
 *
 * Bu action trigger edildiğinde reducer:
 * - packages ile originalPackages'ı karşılaştırır
 * - added, modified, deleted listelerini hesaplar
 * - State'teki step2State.addedPackages, modifiedPackages, deletedPackages'ı günceller
 *
 * Kullanım Senaryoları:
 * - Drag-drop işlemlerinden sonra
 * - Package ekleme/silme işlemlerinden sonra
 * - Pallet değişikliklerinden sonra
 *
 * NOT: OrderDetails'teki calculateOrderDetailChanges benzeri çalışır
 *
 * @example
 * // Effect'te tetikleme
 * this.actions$.pipe(
 *   ofType(StepperActions.movePalletToPackage),
 *   map(() => StepperActions.calculatePackageChanges())
 * )
 */
export const calculatePackageChanges = createAction(
  '[Stepper Step2] Calculate Package Changes'
);

export const deleteRemainingProduct = createAction(
  '[Stepper] Delete Remaining Product',
  props<{ productUiId: string }>()
);


export const addUiProductToRemainingProducts = createAction(
  '[Stepper] Add Ui Product To Remaining Products',
  props<{ productUiId: string }>()
);



export const calculatePackageDetail = createAction(
  '[Stepper] Calculate Package Detail'
);

export const movePalletToPackage = createAction(
  '[Stepper] Move Pallet To Package',
  props<{ containerId: string, previousIndex: number, previousContainerData: any }>()
);

export const splitProduct = createAction(
  '[Stepper] Split Product',
  props<{ productUiId: string, splitCount: number | null }>()
);

export const moveRemainingProductToPackage = createAction(
  '[Stepper] Move Remaining Product From Package',
  props<{ targetPackageId: string, previousIndex: number }>()
);

export const moveUiProductInSamePackage = createAction(
  '[Stepper] Move Ui Product In Same Package',
  props<{ containerId: string, currentIndex: number, previousIndex: number }>()
);

export const removeProductFromPackage = createAction(
  '[Stepper] Remove Product From Package',
  props<{ pkgId: string, productIndex: number }>()
);

export const removePalletFromPackage = createAction(
  '[Stepper] Remove Pallet From Package',
  props<{ pkgId: string }>()
);

export const removeAllPackage = createAction(
  '[Stepper] Remove All Package'
);

export const removePackage = createAction(
  '[Stepper] Remove Package',
  props<{ packageId: string }>()
);

export const moveUiProductInPackageToPackage = createAction(
  '[Stepper] Move Ui Product In Package To Package',
  props<{ sourcePackageId: string, targetPackageId: string, previousIndex: number }>()
);

export const moveUiProductInSamePackageSuccess = createAction(
  '[Stepper] Move Ui Product In Same Package Success'
);

export const palletControlSubmit = createAction(
  '[Stepper] Pallet Control Submit'
);

export const createPackageDetailsSuccess = createAction(
  '[Stepper] Pallet Control Submit Success',
  props<{ packageDetails: any }>()
);

export const updateProductCountAndCreateOrUpdateOrderDetail = createAction(
  '[Stepper] Update Product Count And Create Or Update OrderDetail',
  props<{ product: any, newCount: number }>()
)

export const calculatePackageDetailSuccess = createAction(
  '[Stepper] Calculate Package Detail Success',
  props<{ packages: IUiPackage[] }>()
);

export const remainingProductMoveProduct = createAction(
  '[Stepper] Remaining Product Move Product',
  props<{ previousIndex: number, currentIndex: number }>()
);

export const stepperStepUpdated = createAction(
  '[Stepper] Stepper Step Updated'
);

export const setStep1IsDirty = createAction(
  '[Stepper] Set invoice upload component Is Dirty'
);

export const setStep2IsDirty = createAction(
  '[Stepper] set pallet control component is dirty'
);

export const setStep3IsDirty = createAction(
  '[Stepper] Set Order Result Component Is Dirty'
);

export const setStepperData = createAction(
  '[Stepper] Set Stepper Data',
  props<{ data: any }>()
);


export const createOrderDetails = createAction(
  '[Invoice Upload] Create Order Details'
);

export const createOrderDetailsSuccess = createAction(
  '[Invoice Upload] Create Order Details Success',
  props<{ orderDetails: any[] }>()
);

export const updateOrderDetails = createAction(
  '[Invoice Upload] Update Order Detail Changes',
)

export const updateOrderDetailsSuccess = createAction(
  '[Invoice Upload] update order detail changes success',
  props<{ orderDetails: any[] }>()
);

export const setVerticalSort = createAction(
  '[Stepper] Set Vertical Sort',
  props<{ verticalSort: boolean }>()
);

export const setVerticalSortInPackage = createAction(
  '[Stepper] Set Vertical Sort In Package',
  props<{ pkgId: string, alignment: string }>()
)


export const uploadInvoiceProcessFile = createAction(
  '[Invoice Upload] Upload Invoice Process File',
);


export const uploadInvoiceProcessFileSuccess = createAction(
  '[Invoice Upload] Upload Invoice Process File Success',
);

// create getLocalStorageData
export const restoreLocalStorageData = createAction(
  '[Stepper] Restore Local Storage Data'
);

export const setTemplateFile = createAction(
  '[Invoice Upload] Set Template File',
  props<{ templateFile: any }>()
)

export const setFileExists = createAction(
  '[Stepper] Set File Exists'
)


// create setPackageDetails
export const setUiPackages = createAction(
  '[Stepper] Set Ui Packages',
  props<{ packages: any[] }>()
);

export const setRemainingProducts = createAction(
  '[Stepper] Set Remaining Products',
  props<{ remainingProducts: any[] }>()
);

export const mergeRemainingProducts = createAction(
  '[Stepper] Merge Remaining Products'
);

export const moveProductToRemainingProducts = createAction(
  '[Pallet Control] Move Product To Remaining Products',
  props<{ uiProducts: any, previousIndex: number, previousContainerId: string }>()
);

export const movePartialRemainingProductToPackage = createAction(
  '[Stepper] Move Partial Remaining Product To Package',
  props<{
    targetPackageId: string;
    previousIndex: number;
    maxCount: number;
  }>()
);

export const movePartialProductBetweenPackages = createAction(
  '[Stepper] Move Partial Product Between Packages',
  props<{
    sourcePackageId: string;
    targetPackageId: string;
    previousIndex: number;
    maxCount: number;
  }>()
);

// Navigation Actions
export const navigateToStep = createAction(
  '[Stepper] Navigate To Step',
  props<{ stepIndex: number }>()
);

export const setStepCompleted = createAction(
  '[Stepper] Set Step Completed',
  props<{ stepIndex: number }>()
);

export const setStepValidation = createAction(
  '[Stepper] Set Step Validation',
  props<{ stepIndex: number; isValid: boolean }>()
);

// Edit Mode Actions
export const enableEditMode = createAction(
  '[Stepper] Enable Edit Mode',
  props<{ orderId: string }>()
);


// Reset Actions
export const resetStepper = createAction(
  '[Stepper] Reset Stepper'
);

export const setStepperError = createAction(
  '[Stepper] Set Error',
  props<{ error: string | null }>()
);

// Initialization Action
export const initializeStepper = createAction(
  '[Stepper] Initialize Stepper',
  props<{ editMode?: boolean; editOrderId?: string }>()
);

// Auto-Save Actions (dosyanın sonuna ekleyin)



export const setGlobalError = createAction(
  '[Error] Set Global Error',
  props<{ error: { message: string; code?: string; stepIndex?: number } }>()
);


export const initializeStep1StateFromUpload = createAction(
  '[Migration] Initialize Step1 State From Upload',
  props<{ order: any; orderDetails: any[]; hasFile: boolean; fileName?: string }>()
);

export const addOrderDetail = createAction(
  '[Migration] Add Order Detail',
  props<{ orderDetail: any }>()
);


export const updateOrderDetail = createAction(
  '[Migration] Update Order Detail',
  props<{ orderDetail: any }>()
);

export const deleteOrderDetail = createAction(
  '[Migration] Delete Order Detail',
  props<{ orderDetailId: string }>()
);

export const updateOrderResult = createAction(
  '[Migration] Update Order Result'
);

export const completeShipment = createAction(
  '[Stepper] Shipment Completed',
  props<{ orderResult: string }>()

);

export const getPallets = createAction(
  '[pallet control] get pallets'
)

export const getPalletsSuccess = createAction(
  '[pallet control] get pallets success',
  props<{ pallets: IUiPallet[] }>()
);

export const createReportFile = createAction(
  '[Migration] Create Report File'
);

export const createReportFileSuccess = createAction(
  '[Migration] Create Report File Success',
  props<{ reportFiles: any[] }>()
);


export const syncInvoiceUploadStep = createAction(
  '[Invoice upload] sync invoice upload step'
);


export const resultStepSubmit = createAction(
  '[stepper] result step submit',
  props<{ orderResult: string, resetStepper: boolean, packageNames?: string[] }>()
);

/**
 * Result Step Submit işlemi başarıyla tamamlandı
 *
 * Bu action sadece UI feedback için kullanılır.
 * Facade tüm işlemleri tamamladıktan sonra bu action dispatch edilir.
 */
export const resultStepSubmitSuccess = createAction(
  '[stepper] result step submit success'
);

/**
 * Result Step Submit işlemi sırasında hata oluştu
 *
 * @param error - Hata mesajı
 */
export const resultStepSubmitError = createAction(
  '[stepper] result step submit error',
  props<{ error: string }>()
);
