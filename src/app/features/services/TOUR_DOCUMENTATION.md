# 📚 SHEPHERD.JS TOUR SYSTEM - KAPSAMLI DÖKÜMANTASYON

**Versiyon:** 1.0.0
**Teknoloji:** Angular + Shepherd.js + NgRx

---

## 📑 İçindekiler

1. [Giriş ve Genel Bakış](#1-giriş-ve-genel-bakış)
2. [Kurulum ve Başlangıç](#2-kurulum-ve-başlangıç)
3. [Mimari ve Yapı](#3-mimari-ve-yapı)
4. [Config Sistemi](#4-config-sistemi)
5. [Action Sistemi](#5-action-sistemi)
6. [Store Integration](#6-store-integration)
7. [Translation Sistemi](#7-translation-sistemi)
8. [Styling ve Theming](#8-styling-ve-theming)
9. [Yeni Step Ekleme](#9-yeni-step-ekleme)
10. [Özel Senaryolar](#10-özel-senaryolar)
11. [Troubleshooting](#11-troubleshooting)
12. [API Reference](#12-api-reference)
13. [Best Practices](#13-best-practices)
14. [Appendix](#14-appendix)

---

## 1. Giriş ve Genel Bakış

### 1.1 Nedir?

Bu sistem, **Shepherd.js** kütüphanesi kullanılarak oluşturulmuş, Angular tabanlı bir **interaktif onboarding tour** sistemidir. Multi-step, multi-page yapısıyla karmaşık iş akışlarını kullanıcılara adım adım öğretir.

### 1.2 Özellikler

✅ **Config-Based Architecture:** JSON-like config ile tour tanımlama  
✅ **Multi-Page Support:** NgRx store ile sayfa geçişlerinde devam  
✅ **Asynchronous Actions:** Backend işlemlerini bekleyebilme  
✅ **i18n Support:** Çoklu dil desteği (TR, EN, RU)  
✅ **Custom Theming:** Uygulama temasına uyumlu tasarım  
✅ **Programmatic Interactions:** Dialog doldurma, buton tıklama  
✅ **Demo Mode:** Demo kullanıcılar için otomatik tour  

### 1.3 Kullanım Alanları

- Yeni kullanıcı onboarding
- Feature announcement
- Complex workflow eğitimi
- Demo account guidance
- Product tour

---

## 2. Kurulum ve Başlangıç

### 2.1 Dependencies

```bash
npm install shepherd.js
```

### 2.2 Angular.json Configuration

```json
{
  "styles": [
    "node_modules/shepherd.js/dist/css/shepherd.css",
    "src/styles.scss"
  ]
}
```

### 2.3 Dosya Yapısı

```
src/app/features/services/
├── tour.service.ts                 # Ana tour service
├── configs/
│   └── tour.config.ts             # Tour step tanımları
└── styles/
    └── shepherd-theme.scss        # Custom theme

src/assets/i18n/
├── tr.json                        # Türkçe çeviriler
├── en.json                        # İngilizce çeviriler
└── ru.json                        # Rusça çeviriler
```

### 2.4 Module Import

```typescript
// app.module.ts
import { TourService } from '@app/features/services/tour.service';

@NgModule({
  providers: [TourService]
})
export class AppModule { }
```

---

## 3. Mimari ve Yapı

### 3.1 Genel Akış

```
┌─────────────────┐
│  User Login     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  AuthService    │─────▶│  TourService     │
│  (checkAndStart)│      │  (shouldShowTour)│
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼
                         ┌────────────────┐
                         │  startTour()   │
                         │  Step 0        │
                         └────────┬───────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  ┌─────────────┐        ┌──────────────┐        ┌──────────────┐
  │  Config     │        │  Actions     │        │  Store       │
  │  (steps)    │        │  (click,fill)│        │  (listen)    │
  └─────────────┘        └──────────────┘        └──────────────┘
```

### 3.2 Core Components

#### **TourService** (`tour.service.ts`)
- Tour lifecycle yönetimi
- Action execution
- Store listener'lar
- Helper methods

#### **TourConfig** (`tour.config.ts`)
- Step tanımları
- Selector'lar
- Translation key'leri

#### **Shepherd.js**
- UI rendering
- Tooltip positioning
- Modal overlay

### 3.3 LocalStorage State Management

| Key | Type | Açıklama |
|-----|------|----------|
| `tour_active` | `'true'` \| null | Tour aktif mi? |
| `tour_current_step` | `'0'` \| `'1'` \| `'2'` | Hangi step |
| `tour_continue` | `'true'` \| null | Sonraki step'te devam et |
| `tour_completed` | `'true'` \| null | Tour tamamlandı |
| `tour_waiting_for_calculate` | `'true'` \| null | Calculate bekliyor |
| `tour_waiting_for_order_result` | `'true'` \| null | Order result bekliyor |

---

## 4. Config Sistemi

### 4.1 Config Yapısı

```typescript
export interface TourStepConfig {
  id: string;                    // Unique step ID
  selector?: string;             // CSS selector
  position?: 'top' | 'bottom' | 'left' | 'right';
  text: string;                  // Translation key
  actionText?: string;           // Button text translation key
  action?: string;               // Action name
  onShow?: string;               // onShow action
  showBack?: boolean;            // Geri butonu
  waitForElement?: boolean;      // Element yüklensin mi?
}

export interface TourConfig {
  title: string;
  steps: TourStepConfig[];
}
```

### 4.2 Örnek Config

```typescript
export const TOUR_CONFIG: { [key: string]: TourConfig } = {
  step0: {
    title: 'TOUR.STEP0.TITLE',
    steps: [
      {
        id: 'welcome',
        text: 'TOUR.STEP0.WELCOME',
        showBack: false
      },
      {
        id: 'profile',
        selector: '#tour-profile-menu',
        position: 'bottom',
        text: 'TOUR.STEP0.PROFILE',
        showBack: true,
        waitForElement: true
      }
    ]
  }
};
```

### 4.3 Config Parametreleri

#### **id** (zorunlu)
- Unique step identifier
- Örnek: `'welcome'`, `'product-search'`

#### **selector** (opsiyonel)
- CSS selector string
- Element'e tooltip attach edilir
- Örnek: `'#my-button'`, `'.search-container'`

#### **position** (opsiyonel)
- Tooltip pozisyonu
- Değerler: `'top'`, `'bottom'`, `'left'`, `'right'`
- Default: `'bottom'`

#### **text** (zorunlu)
- Translation key
- Örnek: `'TOUR.STEP0.WELCOME'`

#### **actionText** (opsiyonel)
- Buton üzerindeki text için translation key
- Örnek: `'TOUR.STEP0.LETS_CLICK'`

#### **action** (opsiyonel)
- Action name (executeAction'da tanımlı olmalı)
- Örnek: `'clickManualEntry'`, `'fillOrderDialog'`

#### **onShow** (opsiyonel)
- Step gösterildiğinde otomatik çalışacak action
- Örnek: `'scrollToBottom'`

#### **showBack** (opsiyonel)
- Geri butonu göster/gizle
- Default: `false`

#### **waitForElement** (opsiyonel)
- Element yüklenene kadar bekle
- Default: `false`
- Kullanım: Lazy-loaded element'ler için

---

## 5. Action Sistemi

### 5.1 Action Türleri

#### **Click Actions**
Bir element'e tıklama ve sonraki step'e geçme

```typescript
case 'clickManualEntry':
  this.clickAndNext('#tour-manual-entry', 800);
  break;
```

#### **Fill Actions**
Form doldurma ve submit

```typescript
case 'fillOrderDialog':
  this.fillOrderDialog();
  break;
```

#### **Wait Actions**
Asenkron işlem bekleme

```typescript
case 'clickCalculate':
  this.clickElement('.calculate-button');
  localStorage.setItem('tour_waiting_for_calculate', 'true');
  this.tour?.complete();
  break;
```

#### **Complete Actions**
Step tamamlama ve devam

```typescript
case 'completeStep0':
  this.completeStep(1);
  break;
```

### 5.2 Yeni Action Ekleme

```typescript
// 1. Config'de tanımla
{
  id: 'my-step',
  selector: '#my-button',
  text: 'TOUR.MY_STEP',
  action: 'myCustomAction',
  actionText: 'TOUR.MY_ACTION_BUTTON'
}

// 2. executeAction'da implement et
case 'myCustomAction':
  // Özel işlem
  this.clickElement('#my-button');
  
  // API çağrısı varsa bekle
  this.apiService.doSomething().subscribe(() => {
    this.tour?.next();
  });
  break;
```

### 5.3 Built-in Actions

| Action Name | Açıklama | Kullanım |
|------------|----------|----------|
| `clickManualEntry` | Manuel entry butonuna tıkla | Step 0 |
| `clickAddButton` | Add butonuna tıkla | Step 0 |
| `fillOrderDialog` | Order dialog'unu doldur | Step 0 |
| `clickCalculate` | Calculate butonuna tıkla, sonuç bekle | Step 1 |
| `clickParamsButton` | Params butonuna tıkla | Step 1 |
| `closeParamsDialog` | Dialog'u kapat | Step 1 |
| `clickOptimize` | Optimize butonuna tıkla, sonuç bekle | Step 2 |
| `completeStep0/1/2` | Step'i tamamla | Tüm step'ler |

### 5.4 Action Flow Örneği

```
User clicks "Calculate" button
        ↓
executeAction('clickCalculate')
        ↓
Click .calculate-button
        ↓
Set localStorage: tour_waiting_for_calculate = 'true'
        ↓
Tour.complete() (pause tour)
        ↓
Backend processes...
        ↓
Store updates (selectPackages)
        ↓
handlePackagesResult() catches update
        ↓
Check localStorage flag
        ↓
continueStepTourAfterAction('step1AfterCalculate', 1)
        ↓
New tour starts with result steps
```

---

## 6. Store Integration

### 6.1 Store Listener'lar

Tour sistemi 3 ana store selector'ı dinler:

#### **selectCurrentStep**
NgRx stepper state'i dinler, sayfa geçişlerinde tour'u devam ettirir.

```typescript
this.store.select(selectCurrentStep)
  .pipe(
    filter(step => step !== null && step !== undefined),
    distinctUntilChanged()
  )
  .subscribe(currentStep => this.checkAndContinueTour(currentStep));
```

**Kullanım:**
- Step 0 → Step 1 geçişi
- Step 1 → Step 2 geçişi
- Otomatik tour continuation

#### **selectPackages**
Package optimize sonucunu dinler (Step 1).

```typescript
this.store.select(selectPackages)
  .pipe(
    filter(packages => packages && packages.length > 0),
    distinctUntilChanged()
  )
  .subscribe(() => this.handlePackagesResult());
```

**Kullanım:**
- Calculate butonuna tıklanınca
- Backend optimizasyon yapar
- Sonuç gelince tour devam eder

#### **selectOrderResult**
Order optimization sonucunu dinler (Step 2).

```typescript
this.store.select(selectOrderResult)
  .pipe(
    filter(result => result && result.length > 0),
    distinctUntilChanged()
  )
  .subscribe(() => this.handleOrderResult());
```

**Kullanım:**
- Optimize butonuna tıklanınca
- Backend bin packing yapar
- Sonuç gelince tour devam eder

### 6.2 Multi-Page Tour Flow

```
Step 0 (Invoice Upload Page)
        ↓
User completes step
        ↓
completeStep0() → Set tour_current_step = '1', tour_continue = 'true'
        ↓
Router navigates to Pallet Placement page
        ↓
Store updates: currentStep = 1
        ↓
checkAndContinueTour(1) detects change
        ↓
startStepTour(1) → Step 1 tour begins automatically
```

---

## 7. Translation Sistemi

### 7.1 Translation Structure

```json
{
  "TOUR": {
    "COMMON": {
      "BACK": "Geri",
      "NEXT": "İleri",
      "CONTINUE": "Devam Edelim",
      "UNDERSTOOD": "Anladım",
      "FINISH_TOUR": "Turu Bitir"
    },
    "STEP0": {
      "TITLE": "Sipariş Oluşturma",
      "WELCOME": "<h3>Hoşgeldiniz! 🎉</h3><p>Sistemi adım adım öğreneceksiniz.</p>",
      "PROFILE": "<h3>Profil</h3><p>Buradan profilinize erişebilirsiniz.</p>"
    },
    "STEP1": {
      "TITLE": "Paletleme ve Optimizasyon",
      "WELCOME": "<h3>Paletleme Alanına Hoşgeldiniz! 📦</h3>"
    },
    "STEP2": {
      "TITLE": "Kamyon Yükleme ve 3D Görünüm",
      "WELCOME": "<h3>Kamyon Yükleme! 🚚</h3>"
    }
  }
}
```

### 7.2 HTML İçinde Markup

Translation text'lerinde HTML kullanabilirsiniz:

```json
"WELCOME": "<h3>Başlık</h3><p>Açıklama</p><ul><li>Madde 1</li><li>Madde 2</li></ul>"
```

**Desteklenen Tag'ler:**
- `<h3>`, `<h4>` - Başlıklar
- `<p>` - Paragraflar
- `<ul>`, `<li>` - Liste
- `<strong>`, `<b>` - Kalın
- `<em>` - İtalik
- `<kbd>` - Klavye tuşu

**Örnek:**
```json
"MANUAL_ENTRY": "<h3>Manuel Sipariş Girişi</h3><p>Manuel seçim yapabilir, ürünlerinizi ekleyebilirsiniz.</p><p>Hadi tıklayalım!</p>"
```

### 7.3 Dil Değiştirme

```typescript
// LanguageService ile
this.languageService.setLanguage('en');

// Tour otomatik güncellenir
// TranslateService inject edilmiş durumda
```

---

## 8. Styling ve Theming

### 8.1 Tema Değişkenleri

```scss
$tour-primary: #006a6a;        // Ana renk
$tour-secondary: #d6bb86;      // İkincil renk (altın)
$tour-accent: #004a4a;         // Koyu vurgu
$tour-light-accent: #c0a670;   // Açık vurgu
$tour-background: #f8f9fa;     // Arka plan
$tour-text-dark: #333333;      // Koyu text
$tour-text-light: #666666;     // Açık text
$tour-border: #e0e0e0;         // Border
$tour-white: #ffffff;          // Beyaz
```

### 8.2 Özelleştirme Örnekleri

#### **Buton Renkleri**

```scss
.shepherd-button {
  &:not(.shepherd-button-secondary) {
    background: linear-gradient(135deg, $tour-primary 0%, $tour-accent 100%);
    
    &:hover {
      background: linear-gradient(135deg, $tour-accent 0%, #003535 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 106, 106, 0.3);
    }
  }
}
```

#### **Header Gradient**

```scss
.shepherd-header {
  background: linear-gradient(135deg, $tour-primary 0%, $tour-accent 100%);
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, $tour-secondary 0%, $tour-light-accent 100%);
  }
}
```

#### **Custom Step Type**

```scss
.shepherd-element[data-step-type="warning"] {
  .shepherd-header {
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  }
  
  .shepherd-text h3::before {
    content: '⚠️';
  }
}
```

### 8.3 Responsive Design

```scss
@media (max-width: 768px) {
  .shepherd-element {
    max-width: 90vw;
    
    .shepherd-text {
      padding: 16px;
      font-size: 13px;
      
      h3 {
        font-size: 16px;
      }
    }
  }
}

@media (max-width: 480px) {
  .shepherd-element {
    max-width: 95vw;
    
    .shepherd-footer {
      flex-direction: column;
      
      .shepherd-button {
        width: 100%;
        justify-content: center;
      }
    }
  }
}
```

---

## 9. Yeni Step Ekleme

### 9.1 Adım Adım Kılavuz

#### **Adım 1: Config Oluştur**

```typescript
// tour.config.ts
step3: {
  title: 'TOUR.STEP3.TITLE',
  steps: [
    {
      id: 'step3-welcome',
      text: 'TOUR.STEP3.WELCOME',
      showBack: false
    },
    {
      id: 'my-button',
      selector: '#my-button',
      position: 'bottom',
      text: 'TOUR.STEP3.MY_BUTTON',
      action: 'clickMyButton',
      actionText: 'TOUR.STEP3.CLICK_IT',
      showBack: true,
      waitForElement: true
    }
  ]
}
```

#### **Adım 2: Translation Ekle**

```json
{
  "TOUR": {
    "STEP3": {
      "TITLE": "Yeni Özellik",
      "WELCOME": "<h3>Yeni Özellik! 🎉</h3><p>Bu yeni bir step</p>",
      "MY_BUTTON": "<h3>Buton</h3><p>Bu butona tıklayın</p>",
      "CLICK_IT": "Tıkla"
    }
  }
}
```

#### **Adım 3: Action Ekle (gerekiyorsa)**

```typescript
// tour.service.ts - executeAction
case 'clickMyButton':
  this.clickElement('#my-button');
  setTimeout(() => this.tour?.next(), 500);
  break;
```

#### **Adım 4: HTML ID Ekle**

```html
<!-- my-component.html -->
<button id="my-button" (click)="doSomething()">
  Yeni Özellik
</button>
```

#### **Adım 5: Step Geçişi Ekle**

Eğer önceki step'ten bu step'e geçiş varsa:

```typescript
// Önceki step'in son adımında
case 'completeStep2':
  localStorage.setItem('tour_current_step', '3');
  localStorage.setItem('tour_continue', 'true');
  this.router.navigate(['/step3']); // Route değiştir
  this.tour?.complete();
  break;
```

---

## 10. Özel Senaryolar

### 10.1 Dialog Doldurma

```typescript
private fillMyDialog(): void {
  setTimeout(() => {
    // Input bul
    const input = this.getElement<HTMLInputElement>('#my-input');
    if (!input) return;

    // Doldur
    this.fillInput(input, 'Demo Value');

    setTimeout(() => {
      // Autocomplete varsa seç
      this.waitForAutocompleteAndSelect(() => {
        // Submit
        const submitBtn = this.getElement<HTMLButtonElement>('#submit-btn');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          
          // Next step'e geç
          setTimeout(() => {
            this.waitForElement('#next-element').then(() => {
              this.tour?.next();
            });
          }, 1500);
        }
      });
    }, 1500);
  }, 800);
}
```

### 10.2 Asenkron İşlem Bekleme

```typescript
// 1. Action'da flag set et
case 'startProcess':
  this.clickElement('#process-button');
  localStorage.setItem('tour_waiting_for_process', 'true');
  this.tour?.complete();
  break;

// 2. Constructor'da store listener ekle
this.store.select(selectProcessResult)
  .pipe(
    filter(result => result !== null),
    distinctUntilChanged()
  )
  .subscribe(() => this.handleProcessResult());

// 3. Result handler
private handleProcessResult(): void {
  const waiting = localStorage.getItem('tour_waiting_for_process') === 'true';
  if (waiting) {
    localStorage.removeItem('tour_waiting_for_process');
    setTimeout(() => this.continueAfterProcess(), 1000);
  }
}

// 4. Continue method
private continueAfterProcess(): void {
  this.continueStepTourAfterAction('step1AfterProcess', 1);
}
```

### 10.3 Conditional Steps

```typescript
// Interface'e condition ekle
export interface TourStepConfig {
  // ... mevcut fields
  condition?: string;  // Yeni field
}

// Config'de kullan
{
  id: 'conditional-step',
  selector: '#my-element',
  text: 'TOUR.CONDITIONAL',
  condition: 'hasData'
}

// Service'te check et
private addTourStep(config: TourStepConfig, stepNumber: number): void {
  // Koşul kontrolü
  if (config.condition && !this.checkCondition(config.condition)) {
    return; // Step'i atlat
  }
  
  // Normal flow...
  const stepOptions: any = {
    id: config.id,
    text: this.translate.instant(config.text),
    // ...
  };
}

private checkCondition(condition: string): boolean {
  switch (condition) {
    case 'hasData':
      return this.dataService.hasData();
    case 'isPremium':
      return this.user.isPremium;
    default:
      return true;
  }
}
```

### 10.4 Progress Bar Ekleme

```typescript
// Tour options'a ekle
this.tour = new Shepherd.Tour({
  useModalOverlay: true,
  defaultStepOptions: {
    // ...mevcut options
    showProgress: true,
    progressText: 'Adım ${currentStep} / ${totalSteps}'
  }
});
```

**CSS:**
```scss
.shepherd-progress {
  margin: 12px 0;
  text-align: center;
  font-size: 12px;
  color: #666;
}
```

---

## 11. Troubleshooting

### 11.1 Common Issues

#### **❌ Problem: Element Bulunamıyor**

```typescript
// Element yok hatası
selector: '#my-button'
```

**✅ Çözüm:**

```typescript
// 1. waitForElement ekle
waitForElement: true

// 2. Timeout arttır
beforeShowPromise: () => this.waitForElement(selector, 10000)

// 3. Console'da kontrol et
document.querySelector('#my-button') // null mu?
```

#### **❌ Problem: Tour Sol Üstte Görünüyor (Ghost Card)**

**✅ Çözüm:**

```scss
// styles.scss ekle
.shepherd-element {
  visibility: hidden !important;
  opacity: 0 !important;
  
  &[data-popper-placement] {
    visibility: visible !important;
    opacity: 1 !important;
  }
}

.shepherd-element:not([data-popper-placement]) {
  display: none !important;
}
```

#### **❌ Problem: Autocomplete Açılmıyor**

**✅ Çözüm:**

```typescript
// Input event yeterli değil
searchInput.value = 'value';

// Tüm event'leri tetikle
searchInput.focus();
searchInput.value = 'value';
searchInput.dispatchEvent(new Event('input', { bubbles: true }));
searchInput.dispatchEvent(new Event('focus', { bubbles: true }));
searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
```

#### **❌ Problem: Tour Tekrar Tekrar Başlıyor**

**✅ Çözüm:**

```typescript
private checkAndContinueTour(currentStep: number): void {
  const shouldContinue = localStorage.getItem('tour_continue') === 'true';
  
  if (!shouldContinue) {
    return; // 👈 Erken çık
  }
  
  // ...
  localStorage.removeItem('tour_continue'); // 👈 Mutlaka temizle
}
```

#### **❌ Problem: Dialog Submit Çalışmıyor**

**✅ Çözüm:**

```typescript
const submitBtn = document.querySelector('#submit-btn') as HTMLButtonElement;

// Disabled kontrolü ekle
if (submitBtn && !submitBtn.disabled) {
  submitBtn.click();
} else {
  console.warn('Button disabled or not found');
}
```

### 11.2 Debug Mode Kullanımı

```typescript
// Service'te DEBUG flag
private readonly DEBUG = !environment.production;

// Log helper'lar
private log(message: string): void {
  if (this.DEBUG) {
    console.log(`✅ [TOUR] ${message}`);
  }
}

private warn(message: string): void {
  if (this.DEBUG) {
    console.warn(`⚠️ [TOUR] ${message}`);
  }
}

// Kullanım
this.log('Starting fillOrderDialog');
this.warn('Element not found: #my-button');
```

### 11.3 Testing Checklist

```
□ Demo company ID doğru mu?
□ localStorage.removeItem('tour_completed') ile sıfırlandı mı?
□ Tüm HTML ID'leri ekli mi?
□ Translation key'leri doğru mu?
□ Action'lar executeAction'da tanımlı mı?
□ waitForElement gerekli yerlerde var mı?
□ Store selector'lar dinliyor mu?
□ LocalStorage flag'leri temizleniyor mu?
□ Button disabled kontrolü var mı?
□ Timeout süreleri yeterli mi?
□ Console'da hata var mı?
```

### 11.4 Useful Console Commands

```javascript
// Tour state kontrol
localStorage.getItem('tour_active')
localStorage.getItem('tour_current_step')

// Tour'u sıfırla
localStorage.removeItem('tour_completed')
localStorage.removeItem('tour_active')
localStorage.clear() // Tümünü temizle

// Element kontrol
document.querySelector('#tour-manual-entry')
document.querySelectorAll('[id^="tour-"]') // Tüm tour element'leri

// Autocomplete panel
document.querySelector('.mat-mdc-autocomplete-panel')

// Shepherd element'leri
document.querySelectorAll('.shepherd-element')
document.querySelector('.shepherd-element[data-popper-placement]')
```

---

## 12. API Reference

### 12.1 TourService Public Methods

#### **startTour()**
```typescript
startTour(): void
```
Tour'u başlatır. Demo kullanıcı için otomatik çağrılır.

**Örnek:**
```typescript
this.tourService.startTour();
```

---

#### **resetTour()**
```typescript
resetTour(): void
```
Tour state'ini sıfırlar. `tour_completed` flag'ini kaldırır.

**Örnek:**
```typescript
this.tourService.resetTour();
```

---

#### **restartTour()**
```typescript
restartTour(): void
```
Tour'u sıfırlar ve yeniden başlatır.

**Örnek:**
```typescript
// Header'da "Rehberi Tekrar Başlat" butonu
restartTour() {
  this.tourService.restartTour();
}
```

---

#### **completeTour()**
```typescript
completeTour(): void
```
Tour'u tamamlar, `tour_completed = true` set eder.

**Örnek:**
```typescript
case 'completeStep2':
  this.completeTour();
  break;
```

---

#### **isDemoCompany()**
```typescript
isDemoCompany(companyId: string): boolean
```
Company ID'nin demo company olup olmadığını kontrol eder.

**Parametreler:**
- `companyId`: UUID string

**Döner:**
- `boolean`: Demo company ise `true`

**Örnek:**
```typescript
if (this.tourService.isDemoCompany(user.company_id)) {
  console.log('Demo kullanıcı');
}
```

---

#### **shouldShowTour()**
```typescript
shouldShowTour(companyId: string): boolean
```
Tour gösterilmeli mi kontrolü yapar.

**Parametreler:**
- `companyId`: UUID string

**Döner:**
- `boolean`: Tour gösterilmeli ise `true`

**Örnek:**
```typescript
if (this.tourService.shouldShowTour(user.company_id)) {
  this.tourService.startTour();
}
```

---

### 12.2 Helper Methods (Private)

#### **waitForElement()**
```typescript
private waitForElement(selector: string, timeout = 5000): Promise<void>
```
Element DOM'da görünene kadar bekler.

**Parametreler:**
- `selector`: CSS selector
- `timeout`: Maksimum bekleme süresi (ms)

**Döner:**
- `Promise<void>`

---

#### **clickElement()**
```typescript
private clickElement(selector: string): void
```
Element'e programatik olarak tıklar.

**Parametreler:**
- `selector`: CSS selector

---

#### **fillInput()**
```typescript
private fillInput(input: HTMLInputElement, value: string): void
```
Input'a değer yazar ve Angular event'lerini tetikler.

**Parametreler:**
- `input`: HTMLInputElement
- `value`: Yazılacak değer

---

#### **getElement()**
```typescript
private getElement<T extends HTMLElement>(selector: string): T | null
```
Type-safe element selector.

**Parametreler:**
- `selector`: CSS selector

**Döner:**
- `T | null`: Element veya null

---

### 12.3 Config Interfaces

```typescript
interface TourStepConfig {
  id: string;
  selector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  text: string;
  actionText?: string;
  action?: string;
  onShow?: string;
  showBack?: boolean;
  waitForElement?: boolean;
}

interface TourConfig {
  title: string;
  steps: TourStepConfig[];
}

const TOUR_CONFIG: { [key: string]: TourConfig }
```

---

## 13. Best Practices

### 13.1 ID Naming Convention

```html
<!-- ✅ DOĞRU -->
<button id="tour-manual-entry">...</button>
<div id="tour-order-summary">...</div>
<input id="tour-product-search-input">

<!-- ❌ YANLIŞ -->
<button id="btn1">...</button>
<div id="panel">...</div>
```

**Pattern:** `tour-{feature}-{element}`

**Örnekler:**
- `tour-profile-menu`
- `tour-sidenav-toggle`
- `tour-template-download`
- `tour-table-add-button`
- `tour-dialog-submit-button`

---

### 13.2 Translation Key Convention

```json
{
  "TOUR": {
    "COMMON": { ... },
    "STEP{N}": {
      "STEP_NAME": "..."
    }
  }
}
```

**Pattern:** `TOUR.STEP{N}.{STEP_NAME}`

**Örnekler:**
- `TOUR.STEP0.WELCOME`
- `TOUR.STEP1.CALCULATE`
- `TOUR.STEP2.OPTIMIZE_BUTTON`
- `TOUR.COMMON.NEXT`

---

### 13.3 Timeout Values

```typescript
// Element click → next
setTimeout(() => this.tour?.next(), 500);     // Hızlı işlem

// Dialog açma
setTimeout(() => this.tour?.next(), 800);     // Dialog animasyonu

// API call bekleme
setTimeout(() => this.tour?.next(), 1500);    // Backend işlemi

// Autocomplete bekleme
setTimeout(() => {...}, 1500);                // Material autocomplete
```

**Kural:** Daha uzun timeout = daha güvenli, ama UX yavaşlar

---

### 13.4 Error Handling

```typescript
// ✅ DOĞRU
const element = this.getElement('#my-button');
if (element) {
  element.click();
} else {
  this.warn('Element not found');
  return; // Veya this.tour?.next()
}

// ❌ YANLIŞ
const element = document.querySelector('#my-button')!;
element.click(); // Null pointer exception!
```

**Kural:** Her element selector'dan sonra null check yap

---

### 13.5 Config Organization

```typescript
// ✅ DOĞRU: Her step için ayrı config
export const TOUR_CONFIG = {
  step0: {
    title: 'TOUR.STEP0.TITLE',
    steps: [...]
  },
  step1: {
    title: 'TOUR.STEP1.TITLE',
    steps: [...]
  },
  step1AfterCalculate: { // Sub-step
    title: 'TOUR.STEP1.TITLE',
    steps: [...]
  }
};

// ❌ YANLIŞ: Tek array'de tümü
export const TOUR_CONFIG = {
  steps: [...] // Hepsi karışık
};
```

---

### 13.6 Action Naming

```typescript
// ✅ DOĞRU
'clickManualEntry'    // Açıklayıcı
'fillOrderDialog'     // Ne yaptığı belli
'completeStep0'       // Hangi step
'waitForPackages'     // Ne bekliyor

// ❌ YANLIŞ
'action1'             // Belirsiz
'doIt'                // Ne yapıyor?
'next'                // Generic
'process'             // Vague
```

**Kural:** Action name verb + noun formatında olmalı

---

### 13.7 Store Subscription Management

```typescript
// ✅ DOĞRU: Constructor'da tek subscribe
constructor() {
  this.initializeStoreListeners();
}

private initializeStoreListeners(): void {
  // Tüm listener'lar burada
  this.store.select(selectCurrentStep).subscribe(...);
  this.store.select(selectPackages).subscribe(...);
  this.store.select(selectOrderResult).subscribe(...);
}

// ❌ YANLIŞ: Her yerde ayrı subscribe
ngOnInit() {
  this.store.select(...).subscribe(...);
}
someMethod() {
  this.store.select(...).subscribe(...);
}
```

---

### 13.8 Code Comments

```typescript
// ✅ DOĞRU: Açıklayıcı comment'ler
case 'fillOrderDialog':
  // 1. Wait for dialog to open
  setTimeout(() => {
    // 2. Fill product search
    const searchInput = this.getElement('#tour-product-search-input');
    // ...
  }, 800);
  break;

// ❌ YANLIŞ: Gereksiz comment'ler
case 'fillOrderDialog':
  // Fill dialog
  this.fillOrderDialog(); // Call method
  break;
```

---

## 14. Appendix

### 14.1 Shepherd.js Tour Options

```typescript
new Shepherd.Tour({
  useModalOverlay: boolean,              // Modal overlay göster
  modalOverlayOpeningPadding: number,    // Target element padding (px)
  modalOverlayOpeningRadius: number,     // Köşe yuvarlaklığı (px)
  defaultStepOptions: {
    cancelIcon: {
      enabled: boolean                   // X butonu göster/gizle
    },
    classes: string,                     // Custom CSS class
    scrollTo: {
      behavior: 'smooth' | 'auto',       // Scroll animasyonu
      block: 'center' | 'start' | 'end'  // Scroll pozisyonu
    },
    showProgress: boolean,               // Progress bar göster
    progressText: string                 // Progress text template
  }
})
```

---

### 14.2 Step Options

```typescript
tour.addStep({
  id: string,                            // Unique ID (zorunlu)
  text: string,                          // Content HTML (zorunlu)
  attachTo: {
    element: string | HTMLElement,       // Target element
    on: 'top' | 'bottom' | 'left' | 'right'
  },
  buttons: Array<{
    text: string,                        // Buton metni
    action: () => void,                  // Click handler
    classes?: string                     // CSS class
  }>,
  classes: string,                       // Step custom class
  beforeShowPromise: () => Promise<void>,// Pre-show async logic
  when: {
    show: () => void,                    // Step gösterildiğinde
    hide: () => void,                    // Step gizlendiğinde
    complete: () => void,                // Step tamamlandığında
    cancel: () => void                   // Step iptal edildiğinde
  },
  canClickTarget: boolean,               // Target'a tıklanabilir mi?
  advanceOn: {
    selector: string,                    // Event listener element
    event: string                        // Event tipi (örn: 'click')
  },
  scrollTo: boolean | {                  // Scroll ayarları
    behavior: 'smooth' | 'auto',
    block: 'center' | 'start' | 'end'
  }
})
```

---

### 14.3 Position Options

```typescript
position: 'top'         // Üstte
position: 'bottom'      // Altta
position: 'left'        // Solda
position: 'right'       // Sağda
position: 'top-start'   // Üst-sol
position: 'top-end'     // Üst-sağ
position: 'bottom-start'// Alt-sol
position: 'bottom-end'  // Alt-sağ
position: 'left-start'  // Sol-üst
position: 'left-end'    // Sol-alt
position: 'right-start' // Sağ-üst
position: 'right-end'   // Sağ-alt
```

---

### 14.4 Performance Tips

```typescript
// ✅ DOĞRU: take(1) for one-time operations
this.store.select(selectUser)
  .pipe(take(1))
  .subscribe(user => {
    // Tek seferlik işlem
  });

// ✅ DOĞRU: Unsubscribe on destroy
private subscription: Subscription;

ngOnInit() {
  this.subscription = this.store.select(...).subscribe(...);
}

ngOnDestroy() {
  this.subscription?.unsubscribe();
}

// ✅ DOĞRU: distinctUntilChanged kullan
this.store.select(selectPackages)
  .pipe(
    distinctUntilChanged() // Sadece değişiklikte tetikle
  )
  .subscribe(...);
```

---

### 14.5 Security Considerations

```typescript
// ⚠️ DİKKAT: Translation'da HTML var
text: 'TOUR.STEP0.WELCOME' // "<h3>...</h3>"

// Angular otomatik sanitize eder
// Ama kullanıcıdan gelen data kullanma!

// ❌ YANLIŞ
text: userInput // XSS riski!

// ✅ DOĞRU
text: 'TOUR.HARDCODED.KEY' // i18n'den gelecek
```

---

## 15. FAQ

**Q: Tour'u nasıl disable ederim?**  
A: `shouldShowTour()` metodunda `false` döndür:
```typescript
shouldShowTour(companyId: string): boolean {
  return false; // Tour hiç gösterilmez
}
```

---

**Q: Tour'u her kullanıcıya göstermek istiyorum, demo company kontrolü olmasın?**  
A: `shouldShowTour()` metodunu değiştir:
```typescript
shouldShowTour(companyId: string): boolean {
  return localStorage.getItem('tour_completed') !== 'true';
  // Demo kontrolü kaldırıldı
}
```

---

**Q: Tour esnasında kullanıcı başka yere giderse ne olur?**  
A: Tour otomatik kapanır. `tour_active` flag'i temizlenir. Kullanıcı geri dönerse tour baştan başlamaz (tour_completed varsa).

---

**Q: Backend'e tour completion kaydetmek istiyorum?**  
A: `completeTour()` metoduna API call ekle:
```typescript
completeTour(): void {
  // 1. Backend'e bildir
  this.http.patch('/api/users/me/', { 
    tour_completed: true,
    tour_completed_at: new Date().toISOString()
  }).subscribe();
  
  // 2. LocalStorage'a kaydet
  if (this.tour) {
    this.tour.complete();
    this.tour = null;
  }
  localStorage.setItem('tour_completed', 'true');
  this.cleanupTourState();
}
```

---

**Q: Farklı roller için farklı tour'lar olabilir mi?**  
A: Evet, config'i role göre seç:
```typescript
startTour(): void {
  localStorage.setItem('tour_active', 'true');
  localStorage.setItem('tour_current_step', '0');
  
  // Role göre config seç
  const user = this.getCurrentUser();
  const configKey = user.role === 'admin' ? 'adminStep0' : 'step0';
  
  this.startStepTour(0, configKey);
}
```

---

**Q: Tour'u programatik olarak belirli bir step'ten başlatabilir miyim?**  
A: Evet:
```typescript
// Step 1'den başlat
localStorage.setItem('tour_active', 'true');
localStorage.setItem('tour_current_step', '1');
this.tourService.startStepTour(1);
```

---

**Q: Tour'da animasyon hızını nasıl ayarlarım?**  
A: CSS transition'ları değiştir:
```scss
.shepherd-element {
  transition: opacity 0.5s ease, transform 0.5s ease; // Daha yavaş
}
```

---

**Q: Tour'u mobil cihazlarda nasıl optimize ederim?**  
A: Responsive CSS zaten mevcut, ama ek ayarlar:
```scss
@media (max-width: 768px) {
  .shepherd-element {
    font-size: 14px;
    
    .shepherd-text {
      padding: 12px;
    }
    
    .shepherd-button {
      font-size: 12px;
      padding: 8px 14px;
    }
  }
}
```

---

## 16. Changelog

### Version 1.0.0 (Şubat 2024)
- ✅ Initial release
- ✅ Config-based architecture
- ✅ Multi-step support (Step 0, 1, 2)
- ✅ Store integration (selectCurrentStep, selectPackages, selectOrderResult)
- ✅ i18n support (TR, EN, RU)
- ✅ Custom theming (Uygulama temasına uyumlu)
- ✅ Asynchronous action support
- ✅ Dialog filling automation
- ✅ Wait for element functionality
- ✅ Multi-page tour continuation
- ✅ Debug mode
- ✅ Comprehensive documentation

---

## 17. Support & Contact

**Documentation:** `TOUR_DOCUMENTATION.md`  
**Project:** Lojistik Optimizasyon Sistemi

---

## 18. License

Bu dökümantasyon ve tour sistemi proje için özel olarak geliştirilmiştir.

---

**© 2024 - Shepherd.js Tour System Documentation**  
**Last Updated:** Şubat 2024
