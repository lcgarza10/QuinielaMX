import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

export interface SessionState {
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SessionStateService {
  private readonly INITIAL_LOAD_KEY = 'initialPageLoad';
  private sessionState = new BehaviorSubject<SessionState>({ active: true });

  constructor(private router: Router) {
    if (!this.isInitialPageLoad()) {
      this.startSession();
    } else {
      this.handleInitialLoad();
    }
  }

  private isInitialPageLoad(): boolean {
    return !localStorage.getItem(this.INITIAL_LOAD_KEY);
  }

  private handleInitialLoad() {
    localStorage.setItem(this.INITIAL_LOAD_KEY, 'true');
    if (this.router.url.includes('/login')) {
      this.sessionState.next({ active: false });
    } else {
      this.startSession();
    }
  }

  startSession() {
    this.sessionState.next({ active: true });
  }

  endSession() {
    this.sessionState.next({ active: false });
  }

  getSessionStatus(): Observable<SessionState> {
    return this.sessionState.asObservable();
  }

  isSessionActive(): boolean {
    return this.sessionState.value.active;
  }

  clearInitialLoadFlag() {
    localStorage.removeItem(this.INITIAL_LOAD_KEY);
  }
}