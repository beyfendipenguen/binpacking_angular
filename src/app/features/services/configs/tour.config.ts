export interface TourStepConfig {
  id: string;
  selector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  text: string;
  actionText?: string;
  action?: string;
  onShow?: string;
  showBack?: boolean;
  waitForElement?: boolean;
}

export interface TourConfig {
  title: string;
  steps: TourStepConfig[];
}

export const TOUR_CONFIG: { [key: string]: TourConfig } = {
  // ==================== STEP 0: Invoice Upload ====================
  step0: {
    title: 'TOUR.STEP0.TITLE',
    steps: [
      // 1. Hoşgeldin
      {
        id: 'welcome',
        text: 'TOUR.STEP0.WELCOME',
        showBack: false
      },

      // 2. Profil
      {
        id: 'profile',
        selector: '#tour-profile-menu',
        position: 'bottom',
        text: 'TOUR.STEP0.PROFILE',
        showBack: true,
        waitForElement: true
      },

      // 3. Sidenav
      {
        id: 'sidenav',
        selector: '#tour-sidenav-toggle',
        position: 'right',
        text: 'TOUR.STEP0.SIDENAV',
        showBack: true,
        waitForElement: true
      },

      // 4. Excel Template
      {
        id: 'template',
        selector: '#tour-template-download',
        position: 'left',
        text: 'TOUR.STEP0.TEMPLATE',
        showBack: true,
        waitForElement: true
      },

      // 5. Manuel Entry
      {
        id: 'manual-entry',
        selector: '#tour-manual-entry',
        position: 'bottom',
        text: 'TOUR.STEP0.MANUAL_ENTRY',
        actionText: 'TOUR.STEP0.LETS_CLICK',
        action: 'clickManualEntry',
        showBack: true,
        waitForElement: true
      },

      // 6. Add Button (Order oluştuktan sonra)
      {
        id: 'add-button',
        selector: '#tour-table-add-button',
        position: 'right',
        text: 'TOUR.STEP0.ADD_BUTTON',
        actionText: 'TOUR.STEP0.LETS_CLICK',
        action: 'clickAddButton',
        showBack: true,
        waitForElement: true
      },

      // 7. Dialog açıldı - Product Search
      {
        id: 'dialog-product-search',
        selector: '#tour-product-search-input',
        position: 'bottom',
        text: 'TOUR.STEP0.DIALOG.PRODUCT_SEARCH',
        actionText: 'TOUR.STEP0.DIALOG.FILL_AND_SUBMIT',
        action: 'fillOrderDialog',
        showBack: true,
        waitForElement: true
      },

      // 8. Order Summary Panel
      {
        id: 'order-summary',
        selector: '#tour-order-summary',
        position: 'bottom',
        text: 'TOUR.STEP0.ORDER_SUMMARY',
        showBack: true,
        waitForElement: true
      },

      // 9. Order Details Table
      {
        id: 'order-details',
        selector: '#tour-order-details-table',
        position: 'top',
        text: 'TOUR.STEP0.ORDER_DETAILS',
        showBack: true,
        waitForElement: true
      },

      // 10. Next Button
      {
        id: 'next-button',
        selector: '#tour-next-button',
        position: 'top',
        text: 'TOUR.STEP0.NEXT_BUTTON',
        actionText: 'TOUR.COMMON.CONTINUE',
        action: 'completeStep0',
        showBack: true,
        waitForElement: true
      }
    ]
  },

  // ==================== STEP 1: Pallet Placement ====================
  step1: {
    title: 'TOUR.STEP1.TITLE',
    steps: [
      // 1. Hoşgeldin
      {
        id: 'pallet-welcome',
        text: 'TOUR.STEP1.WELCOME',
        showBack: false
      },

      // 2. Calculate Button (Direkt tıklat)
      {
        id: 'calculate-button',
        selector: '.calculate-button',
        position: 'bottom',
        text: 'TOUR.STEP1.CALCULATE',
        actionText: 'TOUR.STEP1.LETS_CALCULATE',
        action: 'clickCalculate',
        showBack: true,
        waitForElement: true
      }
    ]
  },

  // ==================== STEP 1 - After Calculate ====================
  step1AfterCalculate: {
    title: 'TOUR.STEP1.TITLE',
    steps: [
      // 1. Sonuç geldi
      {
        id: 'after-calculate',
        text: 'TOUR.STEP1.AFTER_CALCULATE',
        showBack: false
      },

      // 2. Product Search
      {
        id: 'product-search',
        selector: '.search-container',
        position: 'bottom',
        text: 'TOUR.STEP1.PRODUCT_SEARCH',
        showBack: true
      },

      // 3. Remaining Products
      {
        id: 'remaining-products',
        selector: '.inventory-section',
        position: 'right',
        text: 'TOUR.STEP1.REMAINING_PRODUCTS',
        showBack: true
      },

      // 4. Pallet Search
      {
        id: 'pallet-search',
        selector: '.pallets-section .search-container',
        position: 'bottom',
        text: 'TOUR.STEP1.PALLET_SEARCH',
        showBack: true
      },

      // 5. Pallet Section
      {
        id: 'pallet-section',
        selector: '.pallets-section',
        position: 'left',
        text: 'TOUR.STEP1.PALLET_SECTION',
        showBack: true
      },

      // 6. Package Section
      {
        id: 'package-section',
        selector: '.packages-section',
        position: 'top',
        text: 'TOUR.STEP1.PACKAGE_SECTION',
        showBack: true
      },

      // 7. Params Calculate Button
      {
        id: 'params-button',
        selector: '.params-button',
        position: 'bottom',
        text: 'TOUR.STEP1.PARAMS_BUTTON',
        actionText: 'TOUR.STEP1.LETS_CLICK',
        action: 'clickParamsButton',
        showBack: true,
        waitForElement: true
      },

      // 8. Dialog açıldı
      {
        id: 'params-dialog',
        selector: '.mat-mdc-dialog-container',
        position: 'top',
        text: 'TOUR.STEP1.PARAMS_DIALOG',
        actionText: 'TOUR.STEP1.CLOSE_DIALOG',
        action: 'closeParamsDialog',
        showBack: true,
        waitForElement: true
      },

      // 9. Next Button
      {
        id: 'next-reminder',
        text: 'TOUR.STEP1.NEXT_REMINDER',
        actionText: 'TOUR.COMMON.UNDERSTOOD',
        action: 'completeStep1',
        showBack: true
      }
    ]
  },

  // ==================== STEP 2: Truck Visualization ====================
 step2: {
    title: 'TOUR.STEP2.TITLE',
    steps: [
      // 1. Hoşgeldin
      {
        id: 'truck-welcome',
        text: 'TOUR.STEP2.WELCOME',
        showBack: false
      },

      // 2. Optimize Button (Direkt tıklat ve bekle)
      {
        id: 'optimize-button',
        selector: '#optimize-button',
        position: 'bottom',
        text: 'TOUR.STEP2.OPTIMIZE_BUTTON',
        actionText: 'TOUR.STEP2.LETS_OPTIMIZE',
        action: 'clickOptimize',
        showBack: true,
        waitForElement: true
      }
    ]
  },

  // 👇 YENİ: Step 2 - After Optimize
  step2AfterOptimize: {
    title: 'TOUR.STEP2.TITLE',
    steps: [
      // 1. Optimizasyon tamamlandı
      {
        id: 'after-optimize',
        text: 'TOUR.STEP2.AFTER_OPTIMIZE',
        showBack: false
      },

      // 2. ThreeJS Frame
      {
        id: 'threejs-view',
        selector: '.visualization-container',
        position: 'top',
        text: 'TOUR.STEP2.THREEJS_VIEW',
        showBack: true,
        waitForElement: true
      },

      // 3. View Controls (Opsiyonel)
      {
        id: 'view-controls',
        selector: '.view-controls',
        position: 'bottom',
        text: 'TOUR.STEP2.VIEW_CONTROLS',
        showBack: true,
        waitForElement: true
      },

      // 4. Report Files
      {
        id: 'report-files',
        selector: '.report-files-container',
        position: 'top',
        text: 'TOUR.STEP2.REPORT_FILES',
        showBack: true,
        waitForElement: true
      },

      // 5. Complete Shipment
      {
        id: 'complete-shipment',
        selector: '.complete-order-button',
        position: 'top',
        text: 'TOUR.STEP2.COMPLETE_SHIPMENT',
        actionText: 'TOUR.COMMON.FINISH_TOUR',
        action: 'completeStep2',
        showBack: true,
        waitForElement: true
      }
    ]
  }
};
