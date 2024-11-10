import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, map, retryWhen, delay, take } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  private isOnline = new BehaviorSubject<boolean>(navigator.onLine);
  private connectionError = new BehaviorSubject<number | null>(null);
  private readonly TEST_URL = 'https://api-football-v1.p.rapidapi.com/v3/timezone';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;
  private retryCount = 0;
  private retryTimer: any;

  constructor(
    private http: HttpClient,
    private toastController: ToastController
  ) {
    this.initializeConnectionListeners();
  }

  private initializeConnectionListeners() {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    
    // Test connection periodically
    timer(0, 30000).subscribe(() => {
      if (navigator.onLine) {
        this.testConnection();
      }
    });
  }

  private async updateOnlineStatus(isOnline: boolean) {
    this.isOnline.next(isOnline);
    
    if (isOnline) {
      await this.testConnection();
    } else {
      this.connectionError.next(-200);
      await this.showConnectionToast('Sin conexión a internet', 'warning');
    }
  }

  getOnlineStatus(): Observable<boolean> {
    return this.isOnline.asObservable();
  }

  getConnectionError(): Observable<number | null> {
    return this.connectionError.asObservable();
  }

  async testConnection(): Promise<boolean> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    // Simply return true if online, false if offline
    const isOnline = navigator.onLine;
    this.isOnline.next(isOnline);
    
    if (!isOnline) {
      this.connectionError.next(-200);
    } else {
      this.connectionError.next(null);
    }

    return isOnline;
  }

  private async handleConnectionError(errorCode: number) {
    this.connectionError.next(errorCode);
    
    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      await this.showConnectionToast('Error de conexión. Intentando reconectar...', 'warning');
      
      this.retryTimer = setTimeout(() => {
        this.testConnection();
      }, this.RETRY_DELAY * this.retryCount);
    } else {
      await this.showConnectionToast('No se pudo establecer conexión. Por favor, verifica tu internet.', 'danger');
      this.retryCount = 0;
    }
  }

  private async showConnectionToast(message: string, color: 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [
        {
          text: 'Reintentar',
          handler: () => {
            this.retryCount = 0;
            this.testConnection();
          }
        }
      ]
    });
    await toast.present();
  }

  clearConnectionError() {
    this.connectionError.next(null);
    this.retryCount = 0;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }
}