import { createAction, props } from '@ngrx/store';
import { UiProduct } from '../../admin/components/stepper/components/ui-models/ui-product.model';
import { UiPackage } from '../../admin/components/stepper/components/ui-models/ui-package.model';


export const deleteRemainingProduct = createAction(
  '[Stepper] Delete Remaining Product',
  props<{ product: UiProduct }>()
);


export const addUiProductToRemainingProducts = createAction(
  '[Stepper] Add Ui Product To Remaining Products',
  props<{ product: UiProduct }>()
);


export const calculatePackageDetail = createAction(
  '[Stepper] Calculate Package Detail'
);

export const movePalletToPackage = createAction(
  '[Stepper] Move Pallet To Package',
  props<{containerId:string, previousIndex:number, previousContainerData:any}>()
);

export const splitProduct = createAction(
  '[Stepper] Split Product',
  props<{product:UiProduct,splitCount:number|null}>()
);

export const moveRemainingProductToPackage = createAction(
  '[Stepper] Move Remaining Product From Package',
  props<{targetPackage:UiPackage,previousIndex:number}>()
);

export const moveUiProductInSamePackage = createAction(
  '[Stepper] Move Ui Product In Same Package',
  props<{containerId:string,currentIndex:number,previousIndex:number}>()
);

export const removeProductFromPackage = createAction(
  '[Stepper] Remove Product From Package',
  props<{pkg:UiPackage,productIndex:number}>()
);

export const removePalletFromPackage = createAction(
  '[Stepper] Remove Pallet From Package',
  props<{pkg:UiPackage}>()
);

export const removeAllPackage = createAction(
  '[Stepper] Remove All Package'
);

export const removePackage = createAction(
  '[Stepper] Remove Package',
  props<{packageToRemove:any}>()
);

export const moveUiProductInPackageToPackage = createAction(
  '[Stepper] Move Ui Product In Package To Package',
  props<{sourcePackage:UiPackage,targetPackage:UiPackage,previousIndex:number}>()
);

export const moveUiProductInSamePackageSuccess = createAction(
  '[Stepper] Move Ui Product In Same Package Success'
);

export const palletControlSubmit = createAction(
  '[Stepper] Pallet Control Submit'
);

export const palletControlSubmitSuccess = createAction(
  '[Stepper] Pallet Control Submit Success',
  props<{packageDetails:any}>()
);

export const updateProductCountAndCreateOrUpdateOrderDetail = createAction(
  '[Stepper] Update Product Count And Create Or Update OrderDetail',
  props<{product:any,newCount:number}>()
)

export const calculatePackageDetailSuccess = createAction(
  '[Stepper] Calculate Package Detail Success',
  props<{packages: any[], remainingOrderDetails: any[]}>()
);

export const remainingProductMoveProduct = createAction(
  '[Stepper] Remaining Product Move Product',
  props<{ previousIndex: number, currentIndex: number }>()
);

export const stepperStepUpdated = createAction(
  '[Stepper] Stepper Step Updated'
);

export const setStepperData = createAction(
  '[Stepper] Set Stepper Data',
  props<{ data: any }>()
);

// create updateOrcreateOrder
export const updateOrCreateOrder = createAction(
  '[Invoice Upload] update or create order',
  props<{ context: string }>()
);

export const updateOrCreateOrderSuccess = createAction(
  '[Invoice Upload] update or create order success',
  props<{ order: any, context: string }>()
);

export const createOrderDetails = createAction(
  '[Invoice Upload] Create Order Details',
  props<{ context: string }>()
);

export const createOrderDetailsSuccess = createAction(
  '[Invoice Upload] Create Order Details Success',
  props<{ orderDetails: any[], context: string }>()
);

export const uploadFileToOrder = createAction(
  '[Invoice Upload] Upload file to Order',
)

export const uploadInvoiceProcessFile = createAction(
  '[Invoice Upload] Upload Invoice Process File',
);

export const uploadFileToOrderSuccess = createAction(
  '[Invoice Upload] Upload file to Order Success',
)

export const uploadInvoiceProcessFileSuccess = createAction(
  '[Invoice Upload] Upload Invoice Process File Success',
);

export const invoiceUploadSubmitSuccess = createAction(
  '[Invoice Upload] Submit Success',
  props<{ orderDetails: any[] }>()
);

export const invoiceUploadSubmitFlow = createAction(
  '[Invoice Upload] Submit Flow',
);

export const invoiceUploadSubmitFlowSuccess = createAction(
  '[Invoice Upload] Submit Flow Success',
);

// create getLocalStorageData
export const restoreLocalStorageData = createAction(
  '[Stepper] Restore Local Storage Data'
);

export const setOrder = createAction(
  '[Stepper] Set Order',
  props<{ order: any }>()
);

export const setFileExists = createAction(
  '[Stepper] Set File Exists'
)

export const setOrderDetails = createAction(
  '[Stepper] Set Order Details',
  props<{ orderDetails: any[] }>()
);

// create setPackageDetails
export const setUiPackages = createAction(
  '[Stepper] Set Ui Packages',
  props<{ packages: any[] }>()
);

export const setRemainingProducts = createAction(
  '[Stepper] Set Remaining Products',
  props<{ remainingProducts: any[] }>()
);

export const moveProductToRemainingProducts = createAction(
  '[Pallet Control] Move Product To Remaining Products',
  props<{uiProducts:any, previousIndex:number, previousContainerId:string}>()
)

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

// Auto-save trigger actions
export const triggerAutoSave = createAction(
  '[Auto-Save] Trigger Auto Save',
  props<{ stepNumber: number; data: any; changeType: 'emergency' | 'data-change' | 'drag-drop' | 'form' | 'user-action' | 'api-response' | 'form-change' }>()
);


// Force save action (manuel kaydetme için)
export const forceSave = createAction(
  '[Auto-Save] Force Save',
  props<{ stepNumber: number; data: any }>()
);

export const setGlobalError = createAction(
  '[Error] Set Global Error',
  props<{ error: { message: string; code?: string; stepIndex?: number } }>()
);

export const retryOperation = createAction(
  '[Error] Retry Operation',
  props<{ stepIndex: number; operation: string }>()
);

// Step-specific Loading Actions
export const setStepLoading = createAction(
  '[Loading] Set Step Loading',
  props<{ stepIndex: number; loading: boolean; operation?: string }>()
);

// StateManager Migration Actions
export const resetStep1State = createAction(
  '[Migration] Initialize Step1 State'
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


export const updateStep3OptimizationResult = createAction(
  '[Migration] Update Step3 Optimization Result',
  props<{ optimizationResult: any[] }>()
);

