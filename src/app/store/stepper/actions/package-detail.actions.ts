import { PackageDetail } from "@app/features/interfaces/package-detail.interface";
import { createAction, props } from "@ngrx/store";

export const PackageDetailActions = {
    upsertMany: createAction(
        '[Package Detail/API] Upsert Many'

    ),

    upsertManySuccess: createAction(
        '[Package Detail/API] Upsert Many Success',
        props<{ packageDetails: PackageDetail[] }>()
    ),

    upsertManyFailure: createAction(
        '[Package Detail/API] Upsert Many Failure',
    ),

}