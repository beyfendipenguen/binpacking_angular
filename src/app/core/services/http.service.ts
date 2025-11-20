import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { ApiService } from "./api.service";

@Injectable({ providedIn: 'root' })
export class HttpService {

    protected baseUrl: string = '';

    constructor(private http: HttpClient, private api: ApiService) {
        this.baseUrl = this.api.getApiUrl();
    }
}
