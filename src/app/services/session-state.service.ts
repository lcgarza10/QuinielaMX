import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

export interface SessionState {
  active: boolean;
  logoutReason?: 'expired' | 'voluntary';
}

@Injectable({
  providedIn: 'root'
})
export class SessionStateService {
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
  private readonly INITIAL_LOAD_KEY = 'initialPageLoad';
  private sessionState = new BehaviorSubject<SessionState>({ active: true });

  constructor(private router: Router) {
    // Only validate session if it's not the initial load
    if (!this.isInitialPageLoad()) {
      this.validateSession();
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
      // Clear any stale session data on initial login page load
      localStorage.removeItem(this.LAST_ACTIVITY_KEY);
      this.sessionState.next({ active: false });
    } else {
      this.startSession();
    }
  }

  private validateSession() {
    const lastActivity = parseInt(localStorage.getItem(this.LAST_ACTIVITY_KEY) || '0', 10);
    const timeSinceLastActivity = Date.now() - lastActivity;

    if (lastActivity === 0) {
      // No previous activity recorded, treat as new session
      this.startSession();
    } else if (timeSinceLastActivity >= this.SESSION_TIMEOUT) {
      this.sessionState.next({ active: false, logoutReason: 'expired' });
    }
  }

  updateLastActivity() {
    if (this.sessionState.value.active) {
      localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    }
  }

  endSession(reason: 'expired' | 'voluntary' = 'voluntary') {
    localStorage.removeItem(this.LAST_ACTIVITY_KEY);
    this.sessionState.next({ active: false, logoutReason: reason });
  }

  startSession() {
    this.sessionState.next({ active: true });
    this.updateLastActivity();
  }

  isSessionActive(): boolean {
    return this.sessionState.value.active;
  }

  getSessionStatus(): Observable<SessionState> {
    return this.sessionState.asObservable();
  }

  clearInitialLoadFlag() {
    localStorage.removeItem(this.INITIAL_LOAD_KEY);
  }
}