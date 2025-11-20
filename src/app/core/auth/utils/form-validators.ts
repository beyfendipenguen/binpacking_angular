import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export function uuidValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;

        if (!value) {
            return null;
        }

        const uuid4 = /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(value)

        return !uuid4 ? { invalidUuid4Format: true } : null;
    }
}
