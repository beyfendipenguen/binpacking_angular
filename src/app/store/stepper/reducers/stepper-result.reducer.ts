import { on } from '@ngrx/store';
import { StepperState } from '../stepper.state';
import { StepperResultActions } from '../actions/stepper-result.actions';
import { PackagePosition } from '@app/features/interfaces/order-result.interface';

/**
 * Aynı pkgId'ye (index 8) sahip satırları tekilleştirir: ilk görülen sıra
 * korunur, değer olarak SON (en taze) satır kullanılır. Bir pkgId'nin
 * sonuçta birden fazla satır olması tır/PDF ağırlığını şişirir ve paket
 * içeriğinin tekrar tekrar listelenmesine yol açar.
 */
function dedupeByPkgId(rows: PackagePosition[]): PackagePosition[] {
  if (!rows || rows.length < 2) return rows;
  const map = new Map<string, PackagePosition>();
  for (const row of rows) map.set(row[8], row);
  return map.size === rows.length ? rows : Array.from(map.values());
}

/**
 * Aktif shipment'ın orderResult'unu günceller VE shipments[activeIndex]'i
 * aynı veriyle senkron tutar. orderResult'ı değiştiren her reducer bunu
 * kullanmalı — aksi halde shipment'lar arası geçişte eski veri geri gelir.
 */
function syncActiveShipment(state: StepperState, rawOrderResult: PackagePosition[]) {
  const newOrderResult = dedupeByPkgId(rawOrderResult);
  const idx = state.step3State.activeShipmentIndex;
  const updatedShipments = state.step3State.shipments.length > 0
    ? state.step3State.shipments.map((s, i) => i === idx ? newOrderResult : s)
    : state.step3State.shipments;
  return { orderResult: newOrderResult, shipments: updatedShipments };
}

export const stepperResultHandlers = [

  // Load Order Result Success (Edit Mode / Calculate sonrası)
  on(StepperResultActions.loadOrderResultSuccess, (state: StepperState, { orderResult, reportFiles, shipments, isMultiShipment, deletedPackages }) => {
    // Kayıtlı sonuçtaki olası kopya pkgId satırlarını yüklerken temizle;
    // tırda olan bir paket aynı zamanda "yerleşmeyen" havuzunda da kalmasın.
    const cleanShipments = (shipments ?? []).map(dedupeByPkgId);
    const cleanOrderResult = dedupeByPkgId([...orderResult]);
    const placedIds = new Set<string>(
      [...cleanOrderResult, ...cleanShipments.flat()].map(row => row[8])
    );
    const cleanDeleted = dedupeByPkgId(deletedPackages ?? []).filter(row => !placedIds.has(row[8]));
    return {
      ...state,
      step2State: syncStep2Remaining(state, cleanDeleted),
      step3State: {
        ...state.step3State,
        orderResult: cleanOrderResult,
        reportFiles,
        shipments: cleanShipments,
        isMultiShipment: isMultiShipment ?? false,
        deletedPackages: cleanDeleted,
        activeShipmentIndex: 0,
        isDirty: false
      }
    };
  }),

  on(StepperResultActions.setActiveShipment, (state: StepperState, { index }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      activeShipmentIndex: index,
      orderResult: state.step3State.shipments[index] ?? [],
    }
  })),

  // Create Report File Success
  on(StepperResultActions.createReportFileSuccess, (state: StepperState, { reportFiles }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      reportFiles: reportFiles,
      isDirty: false
    }
  })),

  // Set Current View Type
  on(StepperResultActions.setCurrentViewType, (state: StepperState, { viewType }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      currentViewType: viewType
    }
  })),

  // ───────── Aktif shipment'ın orderResult'unu değiştiren action'lar ─────────

  on(StepperResultActions.removePackageFromTruck, (state: StepperState, { pkgId }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, state.step3State.orderResult.filter(pos => pos[8] !== pkgId))
    }
  })),

  on(StepperResultActions.addPackageToTruck, (state: StepperState, { position }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, [...state.step3State.orderResult, position])
    }
  })),

  on(StepperResultActions.placePackageInTruck, (state: StepperState, { pkgId, x, y, z }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, state.step3State.orderResult.map(pos =>
        pos[8] === pkgId
          ? [x, y, z, pos[3], pos[4], pos[5], pos[6], pos[7], pkgId] as PackagePosition
          : pos
      ))
    }
  })),

  on(StepperResultActions.setOrderResult, (state: StepperState, { orderResult }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      ...syncActiveShipment(state, orderResult)
    }
  })),

  // ───────── Deleted packages — global havuz ─────────

  on(StepperResultActions.setDeletedPackages, (state: StepperState, { deletedPackages: rawDeleted }) => {
    const deletedPackages = dedupeByPkgId(rawDeleted);
    return {
      ...state,
      step2State: syncStep2Remaining(state, deletedPackages),
      step3State: { ...state.step3State, deletedPackages }
    };
  }),

  on(StepperResultActions.addDeletedPackage, (state: StepperState, { row }) => {
    const newDeleted = dedupeByPkgId([...state.step3State.deletedPackages, row]);
    return {
      ...state,
      step2State: syncStep2Remaining(state, newDeleted),
      step3State: { ...state.step3State, deletedPackages: newDeleted }
    };
  }),

  on(StepperResultActions.removeDeletedPackage, (state: StepperState, { pkgId }) => {
    const newDeleted = state.step3State.deletedPackages.filter(row => row[8] !== pkgId);
    return {
      ...state,
      step2State: syncStep2Remaining(state, newDeleted),
      step3State: { ...state.step3State, deletedPackages: newDeleted }
    };
  }),

  // step2State.packages[].is_remaining senkronizasyonu
  on(StepperResultActions.syncRemainingPackages, (state: StepperState, { deletedPkgIds }) => {
    const deletedSet = new Set(deletedPkgIds);
    return {
      ...state,
      step2State: {
        ...state.step2State,
        packages: state.step2State.packages.map(pkg => ({
          ...pkg,
          is_remaining: !deletedSet.has(pkg.id)
        }))
      }
    };
  }),

  // Set Is Dirty
  on(StepperResultActions.setIsDirty, (state: StepperState, { isDirty }) => ({
    ...state,
    step3State: {
      ...state.step3State,
      isDirty: isDirty
    }
  })),

  // Result Step Submit Success
  on(StepperResultActions.resultStepSubmitSuccess, (state: StepperState) => ({
    ...state,
    step3State: {
      ...state.step3State,
      isDirty: false
    }
  })),

  // Result Step Submit Error
  on(StepperResultActions.resultStepSubmitError, (state: StepperState, { error }) => ({
    ...state,
    globalError: {
      message: error,
      stepIndex: 3,
      timestamp: new Date().toISOString()
    }
  })),

  // Reset Step3 State
  on(StepperResultActions.resetStep3State, (state: StepperState) => ({
    ...state,
    // orderResultId de sıfırlanmalı — aksi halde hasResultsSignal (result-step
    // component'inde artık orderResultId'ye bakıyor) reset sonrasında hâlâ
    // "sonuç var" sanıp yanlış UI durumu gösterebilir.
    orderResultId: "",
    step3State: {
      orderResult: [],
      deletedPackages: [],
      shipments: [],
      activeShipmentIndex: 0,
      isMultiShipment: false,
      reportFiles: [],
      currentViewType: 'isometric',
      hasThreeJSError: false,
      isDirty: false
    }
  })),

  on(StepperResultActions.setOrderResultId, (state: StepperState, { orderResultId }) => ({
    ...state,
    orderResultId: orderResultId
  })),

  on(StepperResultActions.applyBackendSync, (state: StepperState, { deletedPackages, removedPkgIds, nameByPkgId }) => {
    const removedSet = new Set(removedPkgIds);

    // Truck'ta KALAN (silinmeyen/taşınmayan) satırların da görünen numarası
    // (name, index 6) bayatlamış olabilir — backend paket ekleme/silme
    // sonrası TÜM paketleri yeniden numaralandırabiliyor (bkz.
    // _reindex_packages). nameByPkgId'de karşılığı olan ve numarası
    // GERÇEKTEN değişen satırlar burada yerinde güncelleniyor.
    let namesChanged = false;
    const patchName = (row: PackagePosition): PackagePosition => {
      const freshName = nameByPkgId?.[row[8]];
      if (freshName === undefined || row[6] === freshName) return row;
      namesChanged = true;
      const patched = [...row] as PackagePosition;
      patched[6] = freshName;
      return patched;
    };

    const shipments = state.step3State.shipments.map(s =>
      s.filter(row => !removedSet.has(row[8])).map(patchName)
    );

    const idx = state.step3State.activeShipmentIndex;
    const orderResult = state.step3State.isMultiShipment
      ? (shipments[idx] ?? [])
      : state.step3State.orderResult.filter(row => !removedSet.has(row[8])).map(patchName);

    const changed =
      removedSet.size > 0 ||
      namesChanged ||
      deletedPackages.length !== state.step3State.deletedPackages.length;

    return {
      ...state,
      step2State: syncStep2Remaining(state, deletedPackages),
      step3State: {
        ...state.step3State,
        orderResult,
        shipments,
        deletedPackages,
        isDirty: changed ? true : state.step3State.isDirty
      }
    };
  }),
];

function syncStep2Remaining(state: StepperState, deletedPackages: PackagePosition[]) {
  const deletedSet = new Set(deletedPackages.map(row => row[8]));
  return {
    ...state.step2State,
    packages: state.step2State.packages.map(pkg => ({
      ...pkg,
      is_remaining: !deletedSet.has(pkg.id)
    }))
  };
}