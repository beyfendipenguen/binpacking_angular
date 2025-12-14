import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

export interface Language {
  code: string;
  name: string;
  flag: string;
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);

  readonly LANGUAGES: Language[] = [
    { code: 'tr', name: 'Türkçe', flag: 'assets/flags/tr.svg' },
    { code: 'en', name: 'English', flag: 'assets/flags/gb.svg' },
    { code: 'ru', name: 'Русский', flag: 'assets/flags/ru.svg' }
  ];

  private currentLang$ = new BehaviorSubject<string>('tr');
  currentLanguage$ = this.currentLang$.asObservable();

  constructor() {
    this.initializeLanguage();
  }

  private initializeLanguage(): void {
    // 1. localStorage'dan kontrol et
    const savedLang = localStorage.getItem('selectedLanguage');

    // 2. Tarayıcı dilini al
    const browserLang = this.translate.getBrowserLang() || 'tr';

    // 3. Desteklenen diller arasında mı kontrol et
    const supportedLangs = this.LANGUAGES.map(l => l.code);
    const defaultLang = savedLang || browserLang;
    const finalLang = supportedLangs.includes(defaultLang) ? defaultLang : 'tr';

    // 4. Dili ayarla
    this.translate.setDefaultLang('tr'); // ✅ Fallback dil
    this.translate.use(finalLang).subscribe({
      next: () => {
        this.currentLang$.next(finalLang);
        localStorage.setItem('selectedLanguage', finalLang);
        document.documentElement.lang = finalLang;
      },
      error: (err) => {
        // Hata olursa Türkçe'ye fall back
        this.translate.use('tr').subscribe(() => {
          this.currentLang$.next('tr');
          localStorage.setItem('selectedLanguage', 'tr');
          document.documentElement.lang = 'tr';
        });
      }
    });
  }

  setLanguage(lang: string): void {
    this.translate.use(lang).subscribe(() => {
      this.currentLang$.next(lang);
      localStorage.setItem('selectedLanguage', lang);
      document.documentElement.lang = lang;
    });
  }

  getCurrentLanguage(): string {
    return this.currentLang$.value;
  }

  getLanguageByCode(code: string): Language | undefined {
    return this.LANGUAGES.find(l => l.code === code);
  }
}
