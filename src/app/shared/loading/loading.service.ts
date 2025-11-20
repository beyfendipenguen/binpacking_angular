import { Injectable } from "@angular/core";
import { signal } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class LoadingService {
    private _loading = signal(false);
    private _counter = 0;

    public loading = this._loading.asReadonly();

    constructor() {
    }

    loadingOn() {
        this._counter++;
        if (this._counter === 1) {
            this._loading.set(true);
        }
    }

    loadingOff() {
        if (this._counter > 0) {
            this._counter--;
        }

        if (this._counter === 0) {
            this._loading.set(false);
        }
    }

    get counter() {
        return this._counter;
    }

    forceOff() {
        this._counter = 0;
        this._loading.set(false);
    }
}
