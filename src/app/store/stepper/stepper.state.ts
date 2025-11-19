// completed 0 iken hic bir step tamamlanmamis demektir
// mat stepper current indexi gercek hayat ile uyumlu olmasi adina 1 den baslattik
// mat stepper a verirken - 1 yapiyoruz. cunku ilk step 0 olarak tanimli api da

import { IUiPackage } from "../../admin/components/stepper/interfaces/ui-interfaces/ui-package.interface";
import { IUiPallet } from "../../admin/components/stepper/interfaces/ui-interfaces/ui-pallet.interface";
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

  stepData: {
    step1?: any;
    step2?: any;
    step3?: any;
  };

  loading: boolean;
  error: string | null;

  // YENİ: Auto-Save State
  autoSave: {
    [stepNumber: number]: {
      status: 'idle' | 'saving' | 'saved' | 'error';
      lastSaved: Date | null;
      error: string | null;
      pendingChanges: boolean;
    };
  };

  globalError: {
    message: string;
    code?: string;
    stepIndex?: number;
    timestamp?: Date;
  } | null;

  retryAttempts: {
    [stepIndex: number]: number;
  };

  stepLoading: {
    [stepIndex: number]: {
      isLoading: boolean;
      operation?: string;
      progress?: number;
      message?: string;
    };
  };

  step1State: {
    orderDetails: OrderDetailRead[];
    originalOrderDetails: OrderDetailRead[];
    added: OrderDetailWrite[];
    modified: OrderDetailWrite[];
    deletedIds: string[];
    hasFile: boolean;
    fileName?: string;
    templateFile: any;
  };

  step2State: {
    packages: IUiPackage[];
    pallets: IUiPallet[];
    remainingProducts: any[];
    originalPackages: any[];
    originalRemainingProducts: any[];
    addedPackages: any[];
    modifiedPackages: any[];
    deletedPackages: any[];
    isDirty: boolean;
    verticalSort: boolean
  };

  step3State: {
    orderResult: string;
    reportFiles: any[];
    loadingStats: any | null;
    algorithmStats: any | null;
    hasResults: boolean;
    showVisualization: boolean;
    currentViewType: string;
    hasThreeJSError: boolean;
    processedPackages: any[];
    dataChangeHistory: any[];
    hasUnsavedChanges: boolean;
    isDirty: boolean;
  };
}

export const initialStepperState: StepperState = {
  // Mevcut initial values...
  order: null,
  originalOrder: null,
  currentStep: 0,
  completedStep: 0,
  fileExists: false,

  isEditMode: false,


  stepData: {},

  loading: false,
  error: null,

  // YENİ: Auto-Save Initial State
  autoSave: {
    1: { status: 'idle', lastSaved: null, error: null, pendingChanges: false },
    2: { status: 'idle', lastSaved: null, error: null, pendingChanges: false },
    3: { status: 'idle', lastSaved: null, error: null, pendingChanges: false }
  },

  globalError: null,
  retryAttempts: {
    1: 0,
    2: 0,
    3: 0
  },

  stepLoading: {
    1: { isLoading: false },
    2: { isLoading: false },
    3: { isLoading: false }
  },

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
    deletedPackages: [],
    isDirty: false,
    verticalSort: false
  },

  step3State: {
    orderResult: '',
    reportFiles: [],
    loadingStats: null,
    algorithmStats: null,
    hasResults: false,
    showVisualization: false,
    currentViewType: 'isometric',
    hasThreeJSError: false,
    processedPackages: [],
    dataChangeHistory: [],
    hasUnsavedChanges: false,
    isDirty: false
  },
  orderResultId: ""
};
