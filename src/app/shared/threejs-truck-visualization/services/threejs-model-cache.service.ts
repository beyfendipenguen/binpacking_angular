import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Three.js Model Cache Service
 *
 * Görevler:
 * - Model yükleme ve cache yönetimi
 * - LocalStorage entegrasyonu
 * - Memory management
 */

interface CachedModel {
  truck: THREE.Group;
  wheel: THREE.Group;
  timestamp: number;
}

interface ModelMetadata {
  truckPath: string;
  wheelPath: string;
  timestamp: number;
  version: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThreeJSModelCacheService {
  private static modelCache: CachedModel | null = null;
  private static isCacheValid = false;
  private static isLoading = false;
  private static loadingPromise: Promise<CachedModel> | null = null;

  private readonly CACHE_KEY = 'threejs_model_cache_metadata';
  private readonly CACHE_VERSION = '1.0.0';
  private readonly CACHE_EXPIRY_DAYS = 7;

  private gltfLoader = new GLTFLoader();

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize cache from localStorage if available
   */
  private initializeCache(): void {
    try {
      const metadata = this.getCacheMetadata();

      if (metadata && this.isCacheMetadataValid(metadata)) {
        ThreeJSModelCacheService.isCacheValid = true;
      } else {
        this.clearCache();
      }
    } catch (error) {
      console.error('[ModelCache] Initialization error:', error);
      this.clearCache();
    }
  }

  /**
   * Get cached models or load them
   */
  async getModels(): Promise<CachedModel> {
    // Cache geçerliyse ve yüklüyse, direk döndür
    if (ThreeJSModelCacheService.isCacheValid && ThreeJSModelCacheService.modelCache) {
      return Promise.resolve(ThreeJSModelCacheService.modelCache);
    }

    // Zaten yükleme devam ediyorsa, aynı promise'i döndür (중복 방지)
    if (ThreeJSModelCacheService.isLoading && ThreeJSModelCacheService.loadingPromise) {
      return ThreeJSModelCacheService.loadingPromise;
    }

    // Yeni yükleme başlat
    ThreeJSModelCacheService.isLoading = true;
    ThreeJSModelCacheService.loadingPromise = this.loadModels();

    try {
      const models = await ThreeJSModelCacheService.loadingPromise;

      // Cache'i kaydet
      ThreeJSModelCacheService.modelCache = models;
      ThreeJSModelCacheService.isCacheValid = true;

      // Metadata'yı localStorage'a kaydet
      this.saveCacheMetadata();

      return models;
    } finally {
      ThreeJSModelCacheService.isLoading = false;
      ThreeJSModelCacheService.loadingPromise = null;
    }
  }

  /**
   * Load models from files
   */
  private async loadModels(): Promise<CachedModel> {

    const baseUrl = window.location.origin;
    const truckPath = `${baseUrl}/assets/models/truck/truck.gltf`;
    const wheelPath = `${baseUrl}/assets/models/truck/truck-wheels.gltf`;

    try {
      const [truckGltf, wheelGltf] = await Promise.all([
        this.loadGLTF(truckPath),
        this.loadGLTF(wheelPath)
      ]);

      return {
        truck: truckGltf.scene,
        wheel: wheelGltf.scene,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[ModelCache] Model loading failed:', error);
      throw error;
    }
  }

  /**
   * Load a single GLTF model
   */
  private loadGLTF(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => resolve(gltf),
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
        },
        (error) => reject(error)
      );
    });
  }

  /**
   * Clone cached models for use
   */
  cloneModels(models: CachedModel): { truck: THREE.Group; wheel: THREE.Group } {
    return {
      truck: models.truck.clone(true),
      wheel: models.wheel.clone(true)
    };
  }

  /**
   * Clear cache completely
   */
  clearCache(): void {

    // Dispose geometries and materials
    if (ThreeJSModelCacheService.modelCache) {
      this.disposeModel(ThreeJSModelCacheService.modelCache.truck);
      this.disposeModel(ThreeJSModelCacheService.modelCache.wheel);
    }

    ThreeJSModelCacheService.modelCache = null;
    ThreeJSModelCacheService.isCacheValid = false;
    ThreeJSModelCacheService.isLoading = false;
    ThreeJSModelCacheService.loadingPromise = null;

    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Dispose a Three.js model
   */
  private disposeModel(model: THREE.Group): void {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => mat?.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
  }

  /**
   * Save cache metadata to localStorage
   */
  private saveCacheMetadata(): void {
    try {
      const metadata: ModelMetadata = {
        truckPath: 'truck.gltf',
        wheelPath: 'truck-wheels.gltf',
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('[ModelCache] Failed to save metadata:', error);
    }
  }

  /**
   * Get cache metadata from localStorage
   */
  private getCacheMetadata(): ModelMetadata | null {
    try {
      const data = localStorage.getItem(this.CACHE_KEY);
      if (!data) return null;

      return JSON.parse(data) as ModelMetadata;
    } catch (error) {
      console.error('[ModelCache] Failed to parse metadata:', error);
      return null;
    }
  }

  /**
   * Check if cache metadata is valid
   */
  private isCacheMetadataValid(metadata: ModelMetadata): boolean {
    // Version check
    if (metadata.version !== this.CACHE_VERSION) {
      return false;
    }

    // Expiry check
    const expiryTime = metadata.timestamp + (this.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    if (Date.now() > expiryTime) {
      return false;
    }

    return true;
  }

  /**
   * Check if cache is ready
   */
  isCacheReady(): boolean {
    return ThreeJSModelCacheService.isCacheValid && ThreeJSModelCacheService.modelCache !== null;
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): {
    isValid: boolean;
    isLoading: boolean;
    hasModels: boolean;
    timestamp?: number;
  } {
    return {
      isValid: ThreeJSModelCacheService.isCacheValid,
      isLoading: ThreeJSModelCacheService.isLoading,
      hasModels: ThreeJSModelCacheService.modelCache !== null,
      timestamp: ThreeJSModelCacheService.modelCache?.timestamp
    };
  }
}
