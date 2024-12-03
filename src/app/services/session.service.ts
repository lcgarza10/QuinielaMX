import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SessionStateService } from './session-state.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  constructor(
    private router: Router,
    private ngZone: NgZone,
    private toastController: ToastController,
    private sessionState: SessionStateService
  ) {}

  getSessionStatus() {
    return this.sessionState.getSessionStatus();
  }

  private async handleSessionEnd() {
    if (this.router.url.includes('/login')) {
      return;
    }

    localStorage.clear();
    sessionStorage.clear();

    const toast = await this.toastController.create({
      message: 'Has cerrado sesión exitosamente.',
      duration: 3000,
      position: 'top',
      color: 'success',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();

    this.ngZone.run(() => {
      this.router.navigate(['/login'], { 
        replaceUrl: true
      });
    });
  }
}