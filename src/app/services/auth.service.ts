import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  dob?: string;
  totalPoints?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user$: Observable<User | null>;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore
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
            map(dbUser => dbUser || { uid: user.uid, email: user.email || '', totalPoints: 0 }),
            catchError(error => {
              console.error('Error fetching user data:', error);
              return of({ uid: user.uid, email: user.email || '', totalPoints: 0 });
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
      await this.updateUserData(credential.user);
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  async signUpWithEmail(email: string, password: string, firstName: string, lastName: string, username: string, dob: string): Promise<void> {
    try {
      const credential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      await this.updateUserData(credential.user, { firstName, lastName, username, dob });
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
      await this.afAuth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  private async updateUserData(user: any, additionalData?: Partial<User>): Promise<void> {
    const userRef = this.afs.doc(`users/${user.uid}`);
    const userData: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || `${additionalData?.firstName} ${additionalData?.lastName}`,
      ...additionalData
    };

    try {
      const currentData = await userRef.get().toPromise();
      const currentUser = currentData?.data() as User;
      userData.totalPoints = currentUser?.totalPoints ?? 0;

      await userRef.set(userData, { merge: true });
      console.log('User data updated in Firestore');
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  getRedirectResult(): Promise<User | null> {
    return this.afAuth.getRedirectResult().then(result => {
      return result.user ? { uid: result.user.uid, email: result.user.email || '' } : null;
    }).catch(error => {
      console.error('Error getting redirect result:', error);
      return null;
    });
  }
}