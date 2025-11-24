import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UiPackage } from '@features/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { PackageDetail } from '@app/features/interfaces/package-detail.interface';

export const StepperPackageActions = createActionGroup({
  source: 'Stepper Package',
  events: {

    //Package Detail
    'upsertMany': emptyProps(),
    'upsertManySuccess': props<{ packageDetails: PackageDetail[] }>(),
    'upsertManyFailure': emptyProps(),

    // Palet İşlemleri
    'Get Pallets': emptyProps(),
    'Get Pallets Success': props<{ pallets: UiPallet[] }>(),
    'Pallet Control Submit': emptyProps(),

    // Paket Hesaplama
    'Calculate Package Detail': emptyProps(),
    'Calculate Package Detail Success': props<{ packages: UiPackage[] }>(),
    'Set Ui Packages': props<{ packages: UiPackage[] }>(),
    'Calculate Package Changes': emptyProps(),
    'Create Package Details Success': props<{ packageDetails: any }>(),

    // --- DRAG & DROP & MANİPÜLASYON ---

    // Paket İçi
    'Move Ui Product In Same Package': props<{ packageId: string, previousIndex: number, currentIndex: number }>(),
    'Move Ui Product In Same Package Success': emptyProps(),
    'Set Vertical Sort': props<{ verticalSort: boolean }>(),
    'Set Vertical Sort In Package': props<{ pkgId: string, alignment: string}>(),

    // Paketler Arası
    'Move Ui Product In Package To Package': props<{ sourcePackageId: string, targetPackageId: string, previousIndex: number}>(),
    'Move Partial Product Between Packages': props<{ sourcePackageId: string, targetPackageId: string, previousIndex: number, maxCount: number }>(),

    // Remaining (Kalanlar) <-> Paket
    'Move Product To Remaining Products': props<{ uiProducts: any, previousIndex: number, previousContainerId: string }>(),
    'Move Remaining Product To Package': props<{ targetPackageId: string, previousIndex: number}>(),
    'Move Partial Remaining Product To Package': props<{targetPackageId: string,previousIndex: number,maxCount: number}>(),

    // Remaining Alanı İşlemleri
    'Add Ui Product To Remaining Products': props<{ productUiId: string }>(),
    'Delete Remaining Product': props<{ productUiId: string }>(),
    'Remaining Product Move Product': props<{ previousIndex: number, currentIndex: number }>(),
    'Set Remaining Products': props<{ remainingProducts: any[] }>(),
    'Merge Remaining Products': emptyProps(),

    // Palet Sürükleme
    'Move Pallet To Package': props<{ containerId: string, previousIndex: number, previousContainerData: any }>(),
    'Remove Pallet From Package': props<{ packageId: string }>(),

    // Paket Silme/Bölme
    'Remove Package': props<{ packageId: string }>(),
    'Remove All Package': emptyProps(),
    'Remove Product From Package': props<{ pkgId: string, productIndex: number }>(),
    'Split Product': props<{  productUiId: string, splitCount: number | null }>(),

    // Ürün Adet Güncelleme (Popup vb.)
    'Update Product Count And Create Or Update Order Detail': props<{ product: any, count: number }>()
  }
});
