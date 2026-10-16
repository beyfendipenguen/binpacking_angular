// features/customers/components/constraint-form/constraint-form.component.ts
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { Product } from '@app/features/interfaces/product.interface';
import { Truck } from '@app/features/interfaces/truck.interface';
import { ConstraintProfile, createDefaultConstraintProfile } from '@app/features/interfaces/constraint-profile.interface';
import { ProductService } from '@app/features/services/product.service';
import { TruckService } from '@app/features/services/truck.service';
import { CONSTRAINT_FIELDS, ConstraintFieldConfig } from '../../config/constraint-fields.config';

/**
 * single: tek profil düzenleme — açılışta profildeki değerler görünür (eksikse varsayılan).
 * bulk  : toplu güncelleme — boş/"değişiklik yok" alanlar gönderilmez.
 */
export type ConstraintFormMode = 'single' | 'bulk';

type TriState = 'keep' | 'on' | 'off';

/**
 * Kısıt profili formu — ConstraintDialog (tek profil) ve ConstraintBulkDialog (toplu)
 * tarafından ortak kullanılır. Dışarıya SADECE kullanıcının DEĞİŞTİRDİĞİ alanları
 * verir (getChanges): dokunulmayan alanlar (özellikle boolean'lar) asla varsayılana
 * ezilmez.
 */
@Component({
  selector: 'app-constraint-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    TranslateModule,
  ],
  templateUrl: './constraint-form.component.html',
  styleUrl: './constraint-form.component.scss',
})
export class ConstraintFormComponent implements OnInit, OnDestroy {
  @Input() mode: ConstraintFormMode = 'single';
  /** Başlangıç değerleri. bulk modda yalnızca tek ilişki seçiliyse verilir. */
  @Input() profile: Partial<ConstraintProfile> | null = null;

  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private truckService = inject(TruckService);
  private destroy$ = new Subject<void>();

  readonly constraintFields = CONSTRAINT_FIELDS;
  private readonly defaults = createDefaultConstraintProfile();

  form!: FormGroup;
  /** Açılıştaki değerlerin (normalize) anlık görüntüsü — değişiklik tespiti için. */
  private initial: Record<string, unknown> = {};

  // ─── Özel editör durumları ───
  selectedSideProducts: Product[] = [];
  filteredProducts: Product[] = [];
  isSearchingProducts = false;

  forbiddenPairs: Array<{ a: Product; b: Product }> = [];
  forbiddenPairProductA: Product | null = null;
  forbiddenPairProductB: Product | null = null;
  filteredProductsA: Product[] = [];
  filteredProductsB: Product[] = [];
  isSearchingProductsA = false;
  isSearchingProductsB = false;

  zoneLimit: { x_limit_mm: number; max_kg: number } = { x_limit_mm: 0, max_kg: 0 };
  selectedZoneTruckIds: string[] = [];
  availableTrucks: Truck[] = [];
  private zoneTouched = false;

  orientationLock: { threshold_mm: number; align_to: 'width' | 'length' } = {
    threshold_mm: 0,
    align_to: 'width',
  };

  frontRules: { no_rotation: boolean; center_single: boolean; proportional_weight: boolean } = {
    no_rotation: false,
    center_single: false,
    proportional_weight: false,
  };

  /** Toplu düzenleme: her ön bölge kuralı üç durumlu (değişiklik yok / açık / kapalı). */
  frontRulesBulk: Record<'no_rotation' | 'center_single' | 'proportional_weight', TriState> = {
    no_rotation: 'keep',
    center_single: 'keep',
    proportional_weight: 'keep',
  };

  readonly frontRuleKeys = ['no_rotation', 'center_single', 'proportional_weight'] as const;
  readonly frontRuleLabels: Record<'no_rotation' | 'center_single' | 'proportional_weight', string> = {
    no_rotation: 'CONSTRAINT.FRONT_ZONE_NO_ROTATION',
    center_single: 'CONSTRAINT.FRONT_ZONE_CENTER_SINGLE',
    proportional_weight: 'CONSTRAINT.FRONT_ZONE_PROPORTIONAL_WEIGHT',
  };

  currentInfoField: ConstraintFieldConfig | null = null;

  get isBulk(): boolean {
    return this.mode === 'bulk';
  }

  get constraintGroups(): Array<{ key: string; fields: ConstraintFieldConfig[] }> {
    const groupMap = new Map<string, ConstraintFieldConfig[]>();
    for (const field of this.constraintFields) {
      if (!groupMap.has(field.group)) groupMap.set(field.group, []);
      groupMap.get(field.group)!.push(field);
    }
    return Array.from(groupMap.entries()).map(([key, fields]) => ({ key, fields }));
  }

  // ─────────────────────────── Yaşam döngüsü ───────────────────────────

  ngOnInit(): void {
    this.buildForm();
    this.populateCustomEditors();
    this.initial = this.currentValues();
    this.setupSideProductAutocomplete();
    this.setupPairAutocomplete();
    this.loadTrucks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────── Dışarıya açık API ───────────────────────────

  get valid(): boolean {
    return this.form.valid;
  }

  markAllAsTouched(): void {
    this.form.markAllAsTouched();
  }

  /** Sadece değişen alanlar. Boş obje = değişiklik yok. */
  getChanges(): Partial<ConstraintProfile> {
    const cur = this.currentValues();
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(cur)) {
      if (JSON.stringify(cur[key]) === JSON.stringify(this.initial[key])) continue;
      const value = cur[key];
      if (value === null) {
        // null: yalnızca tek profil düzenlemede ve null kabul eden alanlarda "temizle" anlamına gelir.
        if (!this.isBulk && (this.defaults as any)[key] === null) out[key] = null;
        continue;
      }
      out[key] = value;
    }
    return out as Partial<ConstraintProfile>;
  }

  // ─────────────────────────── Form kurulumu ───────────────────────────

  private isPlainControl(field: ConstraintFieldConfig): boolean {
    return !field.disabled && (field.type === 'number' || field.type === 'boolean');
  }

  private buildForm(): void {
    const controls: Record<string, any> = {};

    for (const field of this.constraintFields) {
      if (!this.isPlainControl(field)) continue;
      const profileValue = (this.profile as any)?.[field.key];

      if (field.type === 'boolean') {
        if (this.isBulk) {
          const tri: TriState = profileValue === true ? 'on' : profileValue === false ? 'off' : 'keep';
          controls[field.key] = [tri];
        } else {
          controls[field.key] = [profileValue ?? (this.defaults as any)[field.key] ?? false];
        }
      } else {
        const value = this.isBulk
          ? profileValue ?? null
          : profileValue ?? (this.defaults as any)[field.key] ?? null;
        controls[field.key] = [value, field.validators ?? []];
      }
    }

    controls['side_product_search'] = [''];
    controls['forbidden_pair_search_a'] = [''];
    controls['forbidden_pair_search_b'] = [''];
    this.form = this.fb.group(controls);
  }

  private populateCustomEditors(): void {
    const profile = this.profile;
    const zones = profile?.zone_weight_limits ?? [];
    if (zones.length > 0) {
      this.zoneLimit = { x_limit_mm: zones[0].x_limit_mm, max_kg: zones[0].max_kg };
      this.selectedZoneTruckIds = [...(zones[0].truck_ids ?? [])];
    }
    if (profile?.orientation_lock) {
      this.orientationLock = { ...profile.orientation_lock };
    }
    const fz = profile?.front_zone_rules ?? {};
    this.frontRules = {
      no_rotation: !!fz.no_rotation,
      center_single: !!fz.center_single,
      proportional_weight: !!fz.proportional_weight,
    };
    this.loadSelectedSideProducts(profile?.side_product_ids ?? []);
    this.loadForbiddenPairs(profile?.forbidden_pairs ?? []);
  }

  // ─────────────────────────── Değer toplama ───────────────────────────

  private norm(v: unknown): unknown {
    if (v === undefined || v === '') return null;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
    return v;
  }

  private zoneTruckIds(): string[] | null {
    const sel = this.selectedZoneTruckIds;
    if (!sel.length) return null;
    if (this.availableTrucks.length && this.availableTrucks.every(t => sel.includes(t.id))) return null;
    return [...sel];
  }

  private zoneValue(): unknown[] {
    const x = Number(this.zoneLimit.x_limit_mm) || 0;
    const kg = Number(this.zoneLimit.max_kg) || 0;
    if (!(x > 0 || kg > 0)) return [];
    return [{ x_limit_mm: x, max_kg: kg, truck_ids: this.zoneTruckIds() }];
  }

  private currentValues(): Record<string, unknown> {
    const v: Record<string, unknown> = {};
    for (const field of this.constraintFields) {
      if (field.disabled || field.type === 'disabled-placeholder') continue;

      switch (field.type) {
        case 'number':
          v[field.key] = this.norm(this.form.get(field.key)?.value);
          break;
        case 'boolean': {
          const raw = this.form.get(field.key)?.value;
          if (this.isBulk) v[field.key] = raw === 'on' ? true : raw === 'off' ? false : null;
          else v[field.key] = !!raw;
          break;
        }
        case 'multi-product':
          v[field.key] = this.selectedSideProducts.map(p => p.id);
          break;
        case 'pair-list':
          if (!this.isBulk) v[field.key] = this.forbiddenPairs.map(p => [p.a.id, p.b.id]);
          break;
        case 'zone-limits':
          v[field.key] = this.zoneValue();
          break;
        case 'orientation-lock':
          v[field.key] =
            Number(this.orientationLock.threshold_mm) > 0
              ? {
                  threshold_mm: Number(this.orientationLock.threshold_mm),
                  align_to: this.orientationLock.align_to,
                }
              : null;
          break;
        case 'front-zone-rules':
          if (!this.isBulk) {
            v[field.key] = { ...this.frontRules };
          } else {
            // Toplu: sadece "açık/kapalı" seçilen kurallar gönderilir; backend mevcut
            // değerlerle birleştirir (dokunulmayan kural ezilmez).
            const changed: Record<string, boolean> = {};
            for (const k of this.frontRuleKeys) {
              const t = this.frontRulesBulk[k];
              if (t !== 'keep') changed[k] = t === 'on';
            }
            v[field.key] = Object.keys(changed).length ? changed : null;
          }
          break;
      }
    }
    return v;
  }

  // ─────────────────────────── Bilgi menüsü ───────────────────────────

  showFieldInfo(field: ConstraintFieldConfig): void {
    this.currentInfoField = field;
  }

  // ─────────────────────────── Zone / orientation ───────────────────────────

  onZoneChange(): void {
    this.zoneTouched = true;
  }

  private loadTrucks(): void {
    this.truckService.getAll({ limit: 200, _skipLoading: true }).subscribe({
      next: res => {
        this.availableTrucks = res?.results ?? [];
        // Tırlar yüklendikten sonra "hepsi seçili → null" sadeleştirmesi başlangıç
        // görüntüsünü bozmasın (kullanıcı zone'a dokunmadıysa).
        if (!this.zoneTouched) this.initial['zone_weight_limits'] = this.zoneValue();
      },
      error: () => (this.availableTrucks = []),
    });
  }

  truckLabel(t: Truck): string {
    if (t.name) return t.name;
    const d = t.dimension;
    return d ? `${d.width} x ${d.depth} x ${d.height}` : String(t.id);
  }

  // ─────────────────────────── Yan ürünler ───────────────────────────

  displayProductFn(product: Product): string {
    return product?.name || '';
  }

  onSideProductSelected(product: Product): void {
    if (this.selectedSideProducts.find(p => p.id === product.id)) return;
    this.selectedSideProducts = [...this.selectedSideProducts, product];
    this.form.patchValue({ side_product_search: '' });
    this.filteredProducts = [];
  }

  removeSideProduct(product: Product): void {
    this.selectedSideProducts = this.selectedSideProducts.filter(p => p.id !== product.id);
  }

  private loadSelectedSideProducts(productIds: string[]): void {
    this.selectedSideProducts = productIds.map(id => ({ id, name: id } as Product));
    if (!productIds.length) return;
    this.productService.getByIds(productIds).subscribe({
      next: products => (this.selectedSideProducts = products),
      error: () => { /* ID'lerle devam */ },
    });
  }

  private setupSideProductAutocomplete(): void {
    this.form.get('side_product_search')!.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(value => {
          if (typeof value !== 'string' || value.trim().length < 3) return of([]);
          this.isSearchingProducts = true;
          return this.productService.searchProducts(value.trim(), 10).pipe(
            catchError(() => of([])),
            finalize(() => (this.isSearchingProducts = false)),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((products: Product[]) => {
        const selectedIds = new Set(this.selectedSideProducts.map(p => p.id));
        this.filteredProducts = products.filter(p => !selectedIds.has(p.id));
      });
  }

  // ─────────────────────────── Yasaklı çiftler ───────────────────────────

  onForbiddenPairProductASelected(product: Product): void {
    this.forbiddenPairProductA = product;
    this.form.patchValue({ forbidden_pair_search_a: '' }, { emitEvent: false });
    this.filteredProductsA = [];
  }

  onForbiddenPairProductBSelected(product: Product): void {
    this.forbiddenPairProductB = product;
    this.form.patchValue({ forbidden_pair_search_b: '' }, { emitEvent: false });
    this.filteredProductsB = [];
  }

  addForbiddenPair(): void {
    const a = this.forbiddenPairProductA;
    const b = this.forbiddenPairProductB;
    if (!a || !b || a.id === b.id) return;

    const exists = this.forbiddenPairs.some(
      p => (p.a.id === a.id && p.b.id === b.id) || (p.a.id === b.id && p.b.id === a.id),
    );
    if (!exists) this.forbiddenPairs = [...this.forbiddenPairs, { a, b }];
    this.forbiddenPairProductA = null;
    this.forbiddenPairProductB = null;
  }

  removeForbiddenPair(index: number): void {
    this.forbiddenPairs = this.forbiddenPairs.filter((_, i) => i !== index);
  }

  private loadForbiddenPairs(pairs: string[][]): void {
    const valid = pairs.filter(p => p.length === 2);
    const placeholder = (id: string) => ({ id, name: id } as Product);
    this.forbiddenPairs = valid.map(([a, b]) => ({ a: placeholder(a), b: placeholder(b) }));
    if (!valid.length) return;

    const uniqueIds = Array.from(new Set(valid.flat()));
    this.productService.getByIds(uniqueIds).subscribe({
      next: products => {
        const byId = new Map(products.map(p => [p.id, p]));
        this.forbiddenPairs = valid.map(([idA, idB]) => ({
          a: byId.get(idA) ?? placeholder(idA),
          b: byId.get(idB) ?? placeholder(idB),
        }));
      },
      error: () => { /* ID'lerle devam */ },
    });
  }

  private setupPairAutocomplete(): void {
    const wire = (
      controlName: string,
      setSearching: (v: boolean) => void,
      setResults: (p: Product[]) => void,
    ) => {
      this.form.get(controlName)!.valueChanges
        .pipe(
          debounceTime(400),
          distinctUntilChanged(),
          switchMap(value => {
            if (typeof value !== 'string' || value.trim().length < 3) return of([]);
            setSearching(true);
            return this.productService.searchProducts(value.trim(), 10).pipe(
              catchError(() => of([])),
              finalize(() => setSearching(false)),
            );
          }),
          takeUntil(this.destroy$),
        )
        .subscribe((products: Product[]) => setResults(products));
    };

    wire('forbidden_pair_search_a', v => (this.isSearchingProductsA = v), p => (this.filteredProductsA = p));
    wire('forbidden_pair_search_b', v => (this.isSearchingProductsB = v), p => (this.filteredProductsB = p));
  }
}
