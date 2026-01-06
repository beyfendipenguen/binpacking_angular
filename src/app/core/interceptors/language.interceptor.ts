import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
// Eğer bir dil servisiniz varsa import edin, yoksa localStorage örneği aşağıda:
// import { LanguageService } from './language.service';

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
    // 1. Seçili dili al (Servisten veya LocalStorage'dan)
    // Örnek: const langService = inject(LanguageService); 
    // const currentLang = langService.currentLang(); 

    // Basitlik adına localStorage örneği:
    const currentLang = localStorage.getItem('selectedLanguage') || 'tr';

    // 2. İsteği clone'la ve header ekle
    const clonedReq = req.clone({
        setHeaders: {
            // Django'nun beklediği standart header
            'Accept-Language': currentLang
        }
    });

    // 3. İsteği devam ettir
    return next(clonedReq);
};