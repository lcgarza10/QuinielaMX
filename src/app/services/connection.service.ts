import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConnectionService {
  private isOnline = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    this.initializeConnectionListeners();
  }

  private initializeConnectionListeners() {
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  private updateOnlineStatus(isOnline: boolean) {
    this.isOnline.next(isOnline);
  }

  getOnlineStatus(): Observable<boolean> {
    return this.isOnline.asObservable();
  }
}