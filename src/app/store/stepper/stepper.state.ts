import { IUiPackage } from "../../admin/components/stepper/interfaces/ui-interfaces/ui-package.interface";
import { IUiPallet } from "../../admin/components/stepper/interfaces/ui-interfaces/ui-pallet.interface";
import { IUiProduct } from "../../admin/components/stepper/interfaces/ui-interfaces/ui-product.interface";
import { Document } from "../../models/file.interface";
import { OrderDetailRead, OrderDetailWrite } from "../../models/order-detail.interface";
import { Order } from "../../models/order.interface";

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
    deletedPackageIds: IUiPackage[];
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
