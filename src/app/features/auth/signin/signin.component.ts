import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatLabel } from '@angular/material/form-field';
import { AuthService } from '../../../core/auth/services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { ForgotPasswordDialogComponent } from '@features/profile/forgot-password-dialog/forgot-password-dialog.component';
import { LanguageService } from '@app/core/services/language.service'; // ✅ Ekle

@Component({
  selector: 'app-signin',
  imports: [
    MatButton,
    MatFormField,
    MatInput,
    MatIcon,
    MatLabel,
    ReactiveFormsModule,
    MatCardModule,
    TranslateModule
  ],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent implements OnInit, OnDestroy {
  hide = true;
  signinForm: FormGroup;


  private dialog = inject(MatDialog);
  private languageService = inject(LanguageService); // ✅ Ekle - Service'i inject et

  constructor(
    public fb: FormBuilder,
    public authService: AuthService
  ) {
    // ✅ Service inject edildiğinde constructor çalışır ve dil ayarlanır

    this.signinForm = this.fb.group({
      username: [environment.production ? '' : 'muhammed', [Validators.required]],
      password: [environment.production ? '' : '1911Ahmet.', [Validators.required]]
    });
  }

  loginUser() {
    this.authService.signIn(this.signinForm.value);
  }

  openForgotPasswordDialog() {
    const dialogRef = this.dialog.open(ForgotPasswordDialogComponent, {
      width: '400px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle result
    });
  }

  // --- Properties ---
  mouseX = 0;
  mouseY = 0;
  isMouseInPanel = false;
  glowStyle = 'transparent';

  private animFrameId: number | null = null;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private isMobile = false;

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }
  ngOnInit(): void {
    this.isMobile = window.matchMedia('(max-width: 1024px)').matches;
  }
  onMouseMove(event: MouseEvent): void {
    if (this.isMobile) return;

    const panel = event.currentTarget as HTMLElement;
    const rect = panel.getBoundingClientRect();

    this.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    this.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    const glowX = event.clientX - rect.left;
    const glowY = event.clientY - rect.top;
    this.glowStyle = `radial-gradient(600px circle at ${glowX}px ${glowY}px, rgba(214,187,134,0.08) 0%, transparent 60%)`;

    if (!this.isMouseInPanel) {
      this.isMouseInPanel = true;
      this.animate();
    }
  }

  onMouseLeave(): void {
    this.isMouseInPanel = false;
    this.targetX = 0;
    this.targetY = 0;
    this.glowStyle = 'transparent';
    if (!this.animFrameId) this.animate();
  }

  private animate(): void {
    const ease = 0.06;
    this.currentX += (this.targetX - this.currentX) * ease;
    this.currentY += (this.targetY - this.currentY) * ease;

    this.mouseX = this.currentX;
    this.mouseY = this.currentY;

    if (!this.isMouseInPanel && Math.abs(this.currentX) < 0.001 && Math.abs(this.currentY) < 0.001) {
      this.currentX = 0;
      this.currentY = 0;
      this.mouseX = 0;
      this.mouseY = 0;
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
      return;
    }

    this.animFrameId = requestAnimationFrame(() => this.animate());
  }

  geoTransform(layer: number): string {
    const intensity = layer * 6;
    const tx = this.mouseX * intensity;
    const ty = this.mouseY * intensity;
    return `translate3d(${tx}px, ${ty}px, 0)`;
  }

  logoTransform(): string {
    const tx = this.mouseX * 200;
    const ty = this.mouseY * 200;
    return `translate3d(${tx}px, ${ty}px, 0)`;
  }
}
