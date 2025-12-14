
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { GenericCrudService } from "@app/core/services/generic-crud.service";
import { PackageReadDto } from "../interfaces/package.interface";

@Injectable({
    providedIn: 'root'
})
export class PackageService extends GenericCrudService<PackageReadDto> {
    constructor(http: HttpClient) {
        super(http, 'logistics/packages');
    }
}
