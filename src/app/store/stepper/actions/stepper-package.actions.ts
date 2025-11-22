import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UiPackage } from '@features/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';

export const StepperPackageActions = createActionGroup({
  source: 'Stepper Package',
  events: {
    // Palet İşlemleri
    'Get Pallets': emptyProps(),
    'Get Pallets Success': props<{ pallets: UiPallet[] }>(),
    'Pallet Control Submit': emptyProps(),

    // Paket Hesaplama
    'Calculate Package Detail': emptyProps(),
    'Calculate Package Detail Success': props<{ packages: UiPackage[] }>(),
    'Set Ui Packages': props<{ packages: UiPackage[] }>(),
    'Calculate Package Changes': emptyProps(),
    'Create Package Details Success': emptyProps(),

    // --- DRAG & DROP & MANİPÜLASYON ---

    // Paket İçi
    'Move Ui Product In Same Package': props<{ packageId: string, previousIndex: number, currentIndex: number }>(),
    'Set Vertical Sort In Package': props<{ packageId: string, isVertical: boolean }>(),

    // Paketler Arası
    'Move Ui Product In Package To Package': props<{ fromPackageId: string, toPackageId: string, product: any, targetIndex?: number }>(),
    'Move Partial Product Between Packages': props<{ fromPackageId: string, toPackageId: string, product: any, count: number }>(),

    // Remaining (Kalanlar) <-> Paket
    'Move Product To Remaining Products': props<{ fromPackageId: string, product: any }>(),
    'Move Remaining Product To Package': props<{ toPackageId: string, product: any }>(),
    'Move Partial Remaining Product To Package': props<{ toPackageId: string, product: any, count: number }>(),

    // Remaining Alanı İşlemleri
    'Add Ui Product To Remaining Products': props<{ product: any }>(),
    'Delete Remaining Product': props<{ product: any }>(),
    'Remaining Product Move Product': props<{ previousIndex: number, currentIndex: number }>(),

    // Palet Sürükleme
    'Move Pallet To Package': props<{ palletId: string, packageId: string }>(),
    'Remove Pallet From Package': props<{ packageId: string }>(),

    // Paket Silme/Bölme
    'Remove Package': props<{ packageId: string }>(),
    'Remove All Package': emptyProps(),
    'Remove Product From Package': props<{ packageId: string, productId: string }>(),
    'Split Product': props<{ packageId: string, product: any, splitCount: number }>(),

    // Ürün Adet Güncelleme (Popup vb.)
    'Update Product Count And Create Or Update Order Detail': props<{ product: any, count: number }>()
  }
});
