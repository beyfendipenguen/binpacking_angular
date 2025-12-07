;import { Injectable, NgZone } from '@angular/core';
import * as THREE from 'three';

/**
 * Three.js Render Manager Service
 *
 * Görevler:
 * - On-demand rendering
 * - Performance tracking
 * - Render loop yönetimi
 */

export interface RenderStats {
  fps: number;
  frameTime: number;
  renderCount: number;
  lastRenderTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class ThreeJSRenderManagerService {
  private animationFrameId: number | null = null;
  private needsRender = false;
  private isRendering = false;

  // Performance tracking
  private frameCount = 0;
  private lastFrameTime = 0;
  private renderCount = 0;
  private fpsUpdateInterval = 1000; // 1 saniye
  private lastFpsUpdate = 0;
  private currentFPS = 0;

  constructor(private ngZone: NgZone) {}

  /**
   * Start render loop with on-demand rendering
   */
  startRenderLoop(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    onFrameCallback?: () => void
  ): void {
    if (this.isRendering) {
      console.warn('[RenderManager] Render loop already running');
      return;
    }

    this.isRendering = true;
    this.needsRender = true; // İlk frame'i render et

    // Angular zone dışında çalıştır (performans için)
    this.ngZone.runOutsideAngular(() => {
      const animate = (timestamp: number) => {
        if (!this.isRendering) return;

        this.animationFrameId = requestAnimationFrame(animate);

        // Sadece gerektiğinde render et
        if (this.needsRender) {
          renderer.render(scene, camera);
          this.needsRender = false;
          this.renderCount++;

          // Performance stats güncelle
          this.updatePerformanceStats(timestamp);
        }

        // Frame callback (optional)
        if (onFrameCallback) {
          onFrameCallback();
        }
      };

      animate(performance.now());
    });
  }

  /**
   * Stop render loop
   */
  stopRenderLoop(): void {
    this.isRendering = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Request a single render
   */
  requestRender(): void {
    if (!this.isRendering) {
      console.warn('[RenderManager] Cannot request render - loop not running');
      return;
    }
    this.needsRender = true;
  }

  /**
   * Force immediate render (use sparingly)
   */
  forceRender(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ): void {
    renderer.render(scene, camera);
    this.renderCount++;
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(timestamp: number): void {
    this.frameCount++;

    // FPS hesapla (1 saniyede bir)
    if (timestamp - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      const elapsed = timestamp - this.lastFpsUpdate;
      this.currentFPS = Math.round((this.frameCount * 1000) / elapsed);

      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }

    this.lastFrameTime = timestamp;
  }

  /**
   * Get current render statistics
   */
  getStats(): RenderStats {
    return {
      fps: this.currentFPS,
      frameTime: this.lastFrameTime,
      renderCount: this.renderCount,
      lastRenderTime: this.lastFrameTime
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.frameCount = 0;
    this.renderCount = 0;
    this.lastFrameTime = 0;
    this.lastFpsUpdate = 0;
    this.currentFPS = 0;
  }

  /**
   * Check if currently rendering
   */
  isRenderLoopActive(): boolean {
    return this.isRendering;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopRenderLoop();
    this.resetStats();
  }
}
