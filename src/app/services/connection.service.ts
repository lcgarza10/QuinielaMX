import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  private isOnline = new BehaviorSubject<boolean>(navigator.onLine);
  private connectionError = new BehaviorSubject<number | null>(null);
  private readonly TEST_URL = 'https://www.google.com/favicon.ico';

  constructor(private http: HttpClient) {
    this.initializeConnectionListeners();
  }

  private initializeConnectionListeners() {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    
    // Periodically test connection
    setInterval(() => this.testConnection(), 30000);
  }

  private updateOnlineStatus(isOnline: boolean) {
    this.isOnline.next(isOnline);
    
    if (isOnline) {
      this.testConnection();
    } else {
      this.connectionError.next(-200);
    }
  }

  getOnlineStatus(): Observable<boolean> {
    return this.isOnline.asObservable();
  }

  getConnectionError(): Observable<number | null> {
    return this.connectionError.asObservable();
  }

  async testConnection(): Promise<boolean> {
    try {
      const timestamp = new Date().getTime();
      const result = await this.http.get(`${this.TEST_URL}?t=${timestamp}`, {
        observe: 'response'
      }).pipe(
        map(response => response.status === 200),
        catchError(error => {
          console.error('Connection test failed:', error);
          this.connectionError.next(error.status || -200);
          return of(false);
        })
      ).toPromise();

      // Since we're using Promise.resolve with the piped observable result,
      // we know the result will always be boolean
      if (result === true) {
        this.connectionError.next(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Connection test error:', error);
      this.connectionError.next(-200);
      return false;
    }
  }

  clearConnectionError() {
    this.connectionError.next(null);
  }
}