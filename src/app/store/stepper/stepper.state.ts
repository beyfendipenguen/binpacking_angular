// completed 0 iken hic bir step tamamlanmamis demektir
// mat stepper current indexi gercek hayat ile uyumlu olmasi adina 1 den baslattik
// mat stepper a verirken - 1 yapiyoruz. cunku ilk step 0 olarak tanimli api da

export interface StepperState {
  // Mevcut properties...
  order: any | null;
  currentStep: number;
  completedStep: number;
  fileExists:boolean;

  isEditMode: boolean;

  stepValidations: {
    [stepNumber: number]: boolean;
  };

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
    orderDetails: any[];
    originalOrderDetails: any[];
    added: any[];
    modified: any[];
    deleted: any[];
    hasFile: boolean;
    fileName?: string;
    isDirty: boolean;
    isOnlyOrderDirty:boolean;
  };

   step2State: {
    packages: any[];
    remainingProducts: any[];
    originalPackages: any[];
    originalRemainingProducts: any[];
    addedPackages: any[];
    modifiedPackages: any[];
    deletedPackages: any[];
    isDirty: boolean;
  };

  step3State: {
    optimizationResult: any[];
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
  currentStep: 1,
  completedStep:0,
  fileExists:false,

  isEditMode: false,

  stepValidations: {
    1: false,
    2: false,
    3: false
  },

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
    deleted: [],
    hasFile: false,
    isDirty: false,
    isOnlyOrderDirty: false
  },

  step2State: {
    packages: [],
    remainingProducts: [],
    originalPackages: [],
    originalRemainingProducts: [],
    addedPackages: [],
    modifiedPackages: [],
    deletedPackages: [],
    isDirty: false
  },

  step3State: {
    optimizationResult: [],
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
  }
};
