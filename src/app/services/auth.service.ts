import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
import { SessionStateService } from './session-state.service';

export interface User {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  isAdmin?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private sessionState: SessionStateService
  ) {
    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          return this.afs.doc<User>(`users/${user.uid}`).valueChanges().pipe(
            tap(dbUser => {
              if (!dbUser) {
                console.log('User not found in Firestore, creating new user document');
                this.updateUserData(user);
              }
            }),
            map(dbUser => {
              if (!dbUser) {
                return { uid: user.uid, email: user.email || '', isAdmin: false };
              }
              return {
                ...dbUser,
                uid: user.uid,
                email: user.email || dbUser.email
              };
            }),
            catchError(error => {
              console.error('Error fetching user data:', error);
              return of({ uid: user.uid, email: user.email || '', isAdmin: false });
            })
          );
        } else {
          return of(null);
        }
      }),
      catchError(error => {
        console.error('Error in auth state:', error);
        return of(null);
      })
    );
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      const credential = await this.afAuth.signInWithEmailAndPassword(email, password);
      if (credential.user) {
        await this.updateAuthData(credential.user);
        this.sessionState.startSession();
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async signUpWithEmail(email: string, password: string, firstName: string, lastName: string, username: string): Promise<void> {
    try {
      const credential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      await this.updateUserData(credential.user, { firstName, lastName, username, isAdmin: false });
      this.sessionState.startSession();
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await this.afAuth.sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      localStorage.clear();
      sessionStorage.clear();
      this.sessionState.endSession('voluntary');
      await this.afAuth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    return this.logout();
  }

  async getUser(): Promise<User | null> {
    const firebaseUser = await this.afAuth.currentUser;
    if (!firebaseUser) return null;
    
    const userDoc = await this.afs.doc<User>(`users/${firebaseUser.uid}`).get().toPromise();
    const userData = userDoc?.data();
    
    if (!userData) return null;
    
    return {
      ...userData,
      uid: firebaseUser.uid,
      email: firebaseUser.email || userData.email
    };
  }

  private async updateAuthData(user: any): Promise<void> {
    if (!user) return;

    const userRef = this.afs.doc(`users/${user.uid}`);
    try {
      const existingUser = await userRef.get().toPromise();
      const existingData = existingUser?.data() as User | undefined;
      
      const updatedData: User = {
        uid: user.uid,
        email: user.email || '',
        firstName: existingData?.firstName,
        lastName: existingData?.lastName,
        username: existingData?.username,
        isAdmin: existingData?.isAdmin ?? false
      };

      await userRef.set(updatedData, { merge: true });
    } catch (error) {
      console.error('Error updating auth data:', error);
      throw error;
    }
  }

  private async updateUserData(user: any, additionalData?: Partial<User>): Promise<void> {
    if (!user) return;

    const userRef = this.afs.doc(`users/${user.uid}`);
    try {
      const existingUser = await userRef.get().toPromise();
      const existingData = existingUser?.data() as User | undefined;

      const userData: User = {
        uid: user.uid,
        email: user.email || existingData?.email || '',
        firstName: additionalData?.firstName || existingData?.firstName,
        lastName: additionalData?.lastName || existingData?.lastName,
        username: additionalData?.username || existingData?.username,
        isAdmin: existingData?.isAdmin ?? false
      };

      await userRef.set(userData, { merge: true });
      console.log('User data updated in Firestore');
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  getRedirectResult(): Promise<User | null> {
    return this.afAuth.getRedirectResult().then(result => {
      return result.user ? { uid: result.user.uid, email: result.user.email || '', isAdmin: false } : null;
    }).catch(error => {
      console.error('Error getting redirect result:', error);
      return null;
    });
  }

  isAdmin(user: User | null): boolean {
    return user?.isAdmin === true;
  }
}