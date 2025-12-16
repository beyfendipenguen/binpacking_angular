import { OrderDetailRead, OrderDetailWrite } from "@app/features/interfaces/order-detail.interface";
import { Order } from "@app/features/interfaces/order.interface";
import { IUiPackage } from "@app/features/stepper/interfaces/ui-interfaces/ui-package.interface";
import { IUiPallet } from "@app/features/stepper/interfaces/ui-interfaces/ui-pallet.interface";
import { Document } from "@app/features/interfaces/file.interface";
import { PackageDetailReadDto } from "@app/features/interfaces/package-detail.interface";
import { PackageReadDto, PackageWriteDto } from "@app/features/interfaces/package.interface";
import { ReportFile } from "@app/features/stepper/components/result-step/result-step.service";
import { PackageData } from "@app/features/interfaces/order-result.interface";


export interface StepperState {
  order: Order | null;
  originalOrder: Order | null;
  currentStep: number;
  completedStep: number;
  fileExists: boolean;
  orderResultId: string;

  isEditMode: boolean;
  hasRevisedOrder: boolean;

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
    remainingProducts: PackageDetailReadDto[];
    originalPackages: PackageReadDto[];
    addedPackages: PackageWriteDto[];
    modifiedPackages: PackageWriteDto[];
    deletedPackageIds: string[];
    verticalSort: boolean;
    isDirty: boolean;
  };

  step3State: {
    orderResult: string;
    reportFiles: ReportFile[];
    currentViewType: string;
    hasThreeJSError: boolean;
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
  hasRevisedOrder: false,

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
    addedPackages: [],
    modifiedPackages: [],
    deletedPackageIds: [],
    verticalSort: false,
    isDirty: false
  },

  step3State: {
    orderResult: '',
    reportFiles: [],
    currentViewType: 'isometric',
    hasThreeJSError: false,
    isDirty: false
  },
};
