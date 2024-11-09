import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject, from, timer } from 'rxjs';
import { retryWhen, delay, take, catchError } from 'rxjs/operators';
import { ConnectionService } from './connection.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
  private readonly SESSION_ID_KEY = 'sessionId';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000;
  
  private timeoutId: any;
  private events = ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  private sessionActive = new BehaviorSubject<boolean>(true);
  private retryCount = 0;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private toastController: ToastController,
    private connectionService: ConnectionService
  ) {
    this.initializeSessionMonitoring();
  }

  private initializeSessionMonitoring() {
    // Check session status periodically
    timer(0, 60000).subscribe(() => this.validateSession());
    
    // Monitor visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.validateSession();
      }
    });

    // Monitor storage events
    window.addEventListener('storage', (event) => {
      if (event.key === this.SESSION_ID_KEY) {
        this.validateSession();
      }
    });

    // Monitor connection status
    this.connectionService.getConnectionError().subscribe(error => {
      if (error === -200) {
        this.handleConnectionError();
      }
    });
  }

  initializeSession() {
    try {
      const sessionId = this.generateSessionId();
      localStorage.setItem(this.SESSION_ID_KEY, sessionId);
      this.updateLastActivity();
      this.initializeSessionTimeout();
      this.sessionActive.next(true);
      this.retryCount = 0;
    } catch (error) {
      console.error('Error initializing session:', error);
      this.handleSessionError(error);
    }
  }

  private initializeSessionTimeout() {
    this.events.forEach(event => {
      window.addEventListener(event, () => this.resetTimer());
    });
    this.resetTimer();
  }

  private resetTimer() {
    try {
      this.updateLastActivity();
      
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.timeoutId = setTimeout(() => {
        this.ngZone.run(async () => {
          await this.handleSessionTimeout();
        });
      }, this.SESSION_TIMEOUT);
    } catch (error) {
      console.error('Error resetting timer:', error);
      this.handleSessionError(error);
    }
  }

  private updateLastActivity() {
    try {
      localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error updating last activity:', error);
      this.handleSessionError(error);
    }
  }

  private async validateSession() {
    try {
      const currentSessionId = localStorage.getItem(this.SESSION_ID_KEY);
      const lastActivity = parseInt(localStorage.getItem(this.LAST_ACTIVITY_KEY) || '0', 10);
      const timeSinceLastActivity = Date.now() - lastActivity;

      if (!currentSessionId || timeSinceLastActivity >= this.SESSION_TIMEOUT) {
        await this.handleSessionTimeout();
      }
    } catch (error) {
      console.error('Error validating session:', error);
      this.handleSessionError(error);
    }
  }

  private async handleSessionTimeout() {
    if (!this.sessionActive.value) return;

    try {
      this.sessionActive.next(false);
      this.clearSession();
      
      const toast = await this.toastController.create({
        message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        duration: 3000,
        position: 'top',
        color: 'warning'
      });
      await toast.present();
      
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error handling session timeout:', error);
      this.handleSessionError(error);
    }
  }

  private async handleConnectionError() {
    if (this.retryCount < this.MAX_RETRY_ATTEMPTS) {
      this.retryCount++;
      
      from(this.connectionService.testConnection()).pipe(
        retryWhen(errors => 
          errors.pipe(
            delay(this.RETRY_DELAY),
            take(this.MAX_RETRY_ATTEMPTS)
          )
        ),
        catchError(async () => {
          const toast = await this.toastController.create({
            message: 'Error de conexión. Por favor, verifica tu conexión a internet.',
            duration: 3000,
            position: 'top',
            color: 'danger'
          });
          await toast.present();
          return false;
        })
      ).subscribe();
    }
  }

  private handleSessionError(error: any) {
    if (this.retryCount < this.MAX_RETRY_ATTEMPTS) {
      this.retryCount++;
      setTimeout(() => this.initializeSession(), this.RETRY_DELAY);
    } else {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  clearSession() {
    try {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      
      this.events.forEach(event => {
        window.removeEventListener(event, () => this.resetTimer());
      });

      localStorage.removeItem(this.SESSION_ID_KEY);
      localStorage.removeItem(this.LAST_ACTIVITY_KEY);
      
      this.sessionActive.next(false);
      this.clearLocalData();
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  private clearLocalData() {
    try {
      const theme = localStorage.getItem('darkMode');
      localStorage.clear();
      if (theme) localStorage.setItem('darkMode', theme);
      
      sessionStorage.clear();
      
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
    } catch (error) {
      console.error('Error clearing local data:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  isSessionActive(): boolean {
    return this.sessionActive.value;
  }

  getSessionStatus() {
    return this.sessionActive.asObservable();
  }
}