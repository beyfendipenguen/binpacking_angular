import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UiPackage } from '@features/stepper/components/ui-models/ui-package.model';
import { UiPallet } from '@features/stepper/components/ui-models/ui-pallet.model';
import { PackageDetailReadDto } from '@app/features/interfaces/package-detail.interface';
import { PackageReadDto } from '@app/features/interfaces/package.interface';

export const StepperPackageActions = createActionGroup({
  source: 'Stepper Package',
  events: {

    //Package Detail
    'Upsert Many': emptyProps(),
    'Upsert Many Success': props<{ packages: PackageReadDto[] }>(),
    'Upsert Many Failure': emptyProps(),

    // Palet İşlemleri
    'Get Pallets': emptyProps(),
    'Get Pallets Success': props<{ pallets: UiPallet[] }>(),
    'Pallet Control Submit': emptyProps(),
    'Add Pallet To Available': props<{ pallet: UiPallet }>(),
    // Paket Hesaplama
    'Calculate Package Detail': emptyProps(),
    'Calculate Package Detail Success': props<{ packages: PackageReadDto[] }>(),
    'Set Ui Packages': props<{ packages: UiPackage[] }>(),
    'Calculate Package Changes': emptyProps(),
    'Create Package Details Success': props<{ packageDetails: any }>(),

    // --- DRAG & DROP & MANİPÜLASYON ---

    // Paket İçi
    'Move Package Detail In Same Package': props<{ packageId: string, previousIndex: number, currentIndex: number }>(),
    'Move Ui Product In Same Package Success': emptyProps(),
    'Set Vertical Sort': props<{ verticalSort: boolean }>(),
    'Set Vertical Sort In Package': props<{ pkgId: string, alignment: string }>(),

    // Paketler Arası
    'Move Package Detail In Package To Package': props<{ sourcePackageId: string, targetPackageId: string, previousIndex: number }>(),
    'Move Partial Package Detail Between Packages': props<{ sourcePackageId: string, targetPackageId: string, previousIndex: number, maxCount: number }>(),

    // Remaining (Kalanlar) <-> Paket
    'Move Package Detail To Remaining Products': props<{ packageDetails: PackageDetailReadDto[], previousIndex: number, previousContainerId: string }>(),
    'Move Remaining Product To Package': props<{ targetPackageId: string, previousIndex: number }>(),
    'Move Partial Remaining Product To Package': props<{ targetPackageId: string, previousIndex: number, maxCount: number }>(),

    // Remaining Alanı İşlemleri
    'Reduce Package Detail Count': props<{ packageDetailId: string }>(),
    'Add Package Detail To Remaining Products': props<{ packageDetailId: string }>(),
    'Delete Remaining Products': props<{ packageDetailIds: string[] }>(),
    'Remaining Product Move Product': props<{ previousIndex: number, currentIndex: number }>(),
    'Set Remaining Products': props<{ remainingProducts: PackageDetailReadDto[] }>(),
    'Merge Remaining Products': emptyProps(),

    // Palet Sürükleme
    'Move Pallet To Package': props<{ containerId: string, previousIndex: number, previousContainerData: any }>(),
    'Remove Pallet From Package': props<{ packageId: string }>(),

    // Paket Silme/Bölme
    'Remove Package': props<{ packageId: string }>(),
    'Remove All Package': emptyProps(),
    'Remove Package Detail From Package': props<{ pkgId: string, packageDetailIndex: number }>(),
    'Split Package Detail': props<{ packageDetailId: string, splitCount: number | null }>(),

    // Ürün Adet Güncelleme (Popup vb.)
    'Upsert Package Detail Count': props<{ packageDetail: PackageDetailReadDto, count?: number }>(),
    'Calculate Order Detail Changes': emptyProps(),
  }
});
