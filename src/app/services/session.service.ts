import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
  private timeoutId: any;
  private events = ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  private lastActivity: number = Date.now();
  private sessionActive = new BehaviorSubject<boolean>(true);

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private toastController: ToastController
  ) {
    // Check session status periodically
    setInterval(() => this.checkSessionStatus(), 1000);
  }

  initializeSessionTimeout() {
    // Reset the timer when user activity is detected
    this.events.forEach(event => {
      window.addEventListener(event, () => this.resetTimer());
    });
    
    // Start the initial timer
    this.resetTimer();
    this.sessionActive.next(true);
  }

  resetTimer() {
    this.lastActivity = Date.now();
    
    // Clear the existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Set a new timeout
    this.timeoutId = setTimeout(() => {
      this.ngZone.run(async () => {
        await this.handleSessionTimeout();
      });
    }, this.TIMEOUT);
  }

  private checkSessionStatus() {
    const timeSinceLastActivity = Date.now() - this.lastActivity;
    if (timeSinceLastActivity >= this.TIMEOUT && this.sessionActive.value) {
      this.ngZone.run(async () => {
        await this.handleSessionTimeout();
      });
    }
  }

  private async handleSessionTimeout() {
    if (!this.sessionActive.value) return; // Prevent multiple timeouts

    this.sessionActive.next(false);
    
    try {
      // Clear any cached data
      this.clearLocalData();
      
      // Log out the user
      await this.authService.logout();
      
      // Show timeout message
      const toast = await this.toastController.create({
        message: 'Tu sesión ha expirado por inactividad',
        duration: 3000,
        position: 'top',
        color: 'warning'
      });
      await toast.present();
      
      // Navigate to login
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error handling session timeout:', error);
    }
  }

  clearSession() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    // Remove event listeners
    this.events.forEach(event => {
      window.removeEventListener(event, () => this.resetTimer());
    });

    this.sessionActive.next(false);
    this.clearLocalData();
  }

  private clearLocalData() {
    // Clear all local storage except theme preference
    const theme = localStorage.getItem('darkMode');
    localStorage.clear();
    if (theme) localStorage.setItem('darkMode', theme);
    
    // Clear session storage
    sessionStorage.clear();
    
    // Clear any other cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  }

  isSessionActive(): boolean {
    return this.sessionActive.value;
  }

  getSessionStatus() {
    return this.sessionActive.asObservable();
  }
}