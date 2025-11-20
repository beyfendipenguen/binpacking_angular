import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { Observable } from 'rxjs';
import { ChangePasswordRequest, User } from '../../core/interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private http: HttpClient,private api: ApiService) {}


  private formatPhoneNumber(phone: string | null, countryCode: string = '+90'): string | null {
    if (!phone) return null;

    // Sadece rakamları al
    const cleaned = phone.replace(/\D/g, '');

    if (!cleaned) return null;

    // Ülke kodunu ekle
    return countryCode + cleaned;
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.api.getApiUrl()}/profile/`);
  }

  updateProfile(profileData: Partial<User>): Observable<User> {
    if (profileData.phone) {
      profileData.phone = this.formatPhoneNumber(profileData.phone);
    }
    return this.http.put<User>(`${this.api.getApiUrl()}/profile/`, profileData);
  }

  updateChangedFields(changedFields: Partial<User>, countryCode?: string): Observable<User> {
    const fieldsToUpdate = {...changedFields};

    // Telefon numarası değişmişse formatla
    if (fieldsToUpdate.phone && countryCode) {
      fieldsToUpdate.phone = this.formatPhoneNumber(fieldsToUpdate.phone, countryCode);
    }

    return this.http.patch<User>(`${this.api.getApiUrl()}/profile/`, fieldsToUpdate);
  }

  updateProfilePicture(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return this.http.put<User>(`${this.api.getApiUrl()}/profile/picture/`, formData);
  }

  changePassword(passwords: ChangePasswordRequest): Observable<any> {
    return this.http.post(`${this.api.getApiUrl()}/profile/change-password/`, passwords);
  }

  // Şifre sıfırlama istekleri
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.api.getApiUrl()}/password-reset/`, { email });
  }

  // Şifre sıfırlama doğrulama - token/uidb64 eklendi
  validatePasswordResetToken(uidb64: string, token: string): Observable<any> {
    return this.http.get(`${this.api.getApiUrl()}/password-reset/validate/${uidb64}/${token}/`);
  }

  // Yeni şifre belirleme - token/uidb64 eklendi
  resetPassword(uidb64: string, token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.api.getApiUrl()}/password-reset/confirm/${uidb64}/${token}/`, {
      new_password: newPassword
    });
  }
}
