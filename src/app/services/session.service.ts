import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SessionStateService } from './session-state.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly SESSION_CHECK_INTERVAL = 60000; // Check every minute
  private checkInterval: any;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private toastController: ToastController,
    private sessionState: SessionStateService
  ) {
    this.initializeSessionMonitoring();
  }

  private initializeSessionMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => this.validateSession(), this.SESSION_CHECK_INTERVAL);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.validateSession();
      }
    });

    this.sessionState.getSessionStatus().subscribe(state => {
      if (!state.active && state.logoutReason) { // Only handle if there's a specific reason
        this.handleSessionEnd(state.logoutReason);
      }
    });
  }

  private validateSession() {
    if (!this.sessionState.isSessionActive() && !this.router.url.includes('/login')) {
      this.sessionState.endSession('expired');
    }
  }

  private async handleSessionEnd(reason?: 'expired' | 'voluntary') {
    if (!reason || this.router.url.includes('/login')) {
      return; // Don't show message on initial load or if already on login page
    }

    // Clear session data
    localStorage.clear();
    sessionStorage.clear();

    // Show appropriate message
    const message = reason === 'expired' 
      ? 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      : 'Has cerrado sesión exitosamente.';

    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: reason === 'expired' ? 'warning' : 'success',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();

    // Navigate to login
    this.ngZone.run(() => {
      this.router.navigate(['/login'], { 
        replaceUrl: true,
        queryParams: reason === 'expired' ? { expired: true } : {}
      });
    });
  }

  updateLastActivity() {
    if (!this.router.url.includes('/login')) {
      this.sessionState.updateLastActivity();
    }
  }

  isSessionActive(): boolean {
    return this.sessionState.isSessionActive();
  }

  getSessionStatus() {
    return this.sessionState.getSessionStatus();
  }

  ngOnDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.sessionState.clearInitialLoadFlag();
  }
}