import { OrderDetailRead, OrderDetailWrite } from "@app/features/interfaces/order-detail.interface";
import { Order } from "@app/features/interfaces/order.interface";
import { IUiPackage } from "@app/features/stepper/interfaces/ui-interfaces/ui-package.interface";
import { IUiPallet } from "@app/features/stepper/interfaces/ui-interfaces/ui-pallet.interface";
import { IUiProduct } from "@app/features/stepper/interfaces/ui-interfaces/ui-product.interface";
import { Document } from "@app/features/interfaces/file.interface";

export interface StepperState {
  // Mevcut properties...
  order: Order | null;
  originalOrder: Order | null;
  currentStep: number;
  completedStep: number;
  fileExists: boolean;
  orderResultId: string;

  isEditMode: boolean;

  error: string | null;


  globalError: {
    message: string;
    code?: string;
    stepIndex?: number;
    timestamp?: Date;
  } | null;

  step1State: {
    orderDetails: OrderDetailRead[];
    originalOrderDetails: OrderDetailRead[];
    added: OrderDetailWrite[];
    modified: OrderDetailWrite[];
    deletedIds: string[];
    hasFile: boolean;
    fileName?: string;
    templateFile: Document | null;
  };

  step2State: {
    packages: IUiPackage[];
    pallets: IUiPallet[];
    remainingProducts: IUiProduct[];
    originalPackages: IUiPackage[];
    originalRemainingProducts: IUiProduct[];
    addedPackages: IUiPackage[];
    modifiedPackages: IUiPackage[];
    deletedPackageIds: string[];
    isDirty: boolean;
    verticalSort: boolean
  };

  step3State: {
    orderResult: string;
    reportFiles: Document[];
    currentViewType: string;
    hasThreeJSError: boolean;
    processedPackages: string[];
    isDirty: boolean;
  };
}

export const initialStepperState: StepperState = {

  order: null,
  originalOrder: null,
  currentStep: 0,
  completedStep: 0,
  fileExists: false,
  orderResultId: "",
  isEditMode: false,

  error: null,
  globalError: null,

  step1State: {
    orderDetails: [],
    originalOrderDetails: [],
    added: [],
    modified: [],
    deletedIds: [],
    hasFile: false,
    templateFile: null
  },

  step2State: {
    packages: [],
    pallets: [],
    remainingProducts: [],
    originalPackages: [],
    originalRemainingProducts: [],
    addedPackages: [],
    modifiedPackages: [],
    deletedPackageIds: [],
    isDirty: false,
    verticalSort: false
  },

  step3State: {
    orderResult: '',
    reportFiles: [],
    currentViewType: 'isometric',
    processedPackages: [],
    hasThreeJSError: false,
    isDirty: false
  },

};
