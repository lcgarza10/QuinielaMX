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
  private readonly TEST_URL = 'https://www.google.com/favicon.ico';
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

    try {
      const timestamp = new Date().getTime();
      const result = await this.http.get(`${this.TEST_URL}?t=${timestamp}`, {
        observe: 'response'
      }).pipe(
        map(response => response.status === 200),
        retryWhen(errors => 
          errors.pipe(
            delay(this.RETRY_DELAY),
            take(this.MAX_RETRIES)
          )
        ),
        catchError(error => {
          console.error('Connection test failed:', error);
          this.handleConnectionError(error.status || -200);
          return of(false);
        })
      ).toPromise();

      if (result) {
        this.connectionError.next(null);
        this.retryCount = 0;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Connection test error:', error);
      this.handleConnectionError(-200);
      return false;
    }
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