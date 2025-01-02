import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError, tap } from 'rxjs/operators';
import { SessionStateService } from './session-state.service';
import { Router } from '@angular/router';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from '../../environments/environment';

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
  private app = initializeApp(environment.firebase);

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private sessionState: SessionStateService,
    private router: Router
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
      // Validar longitud del nombre de usuario
      if (username.length > 10) {
        throw new Error('El nombre de usuario no puede tener más de 10 caracteres');
      }

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
      this.sessionState.endSession();
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

  async signInWithGoogle(): Promise<void> {
    try {
      console.log('Starting Google sign in...', window.location.hostname);
      const auth = getAuth(this.app);
      const provider = new GoogleAuthProvider();
      
      // Agregar configuración adicional al provider
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      console.log('Opening Google popup...');
      const credential = await signInWithPopup(auth, provider);
      console.log('Got Google credential:', credential.user?.uid);
      
      if (credential.user) {
        // Verificar si el usuario ya existe en Firestore
        console.log('Checking if user exists in Firestore...');
        const userDoc = await this.afs.doc<User>(`users/${credential.user.uid}`).get().toPromise();
        const existingUser = userDoc?.data();
        
        if (existingUser && existingUser.username) {
          // Usuario existente con nombre de usuario - proceder al inicio de sesión
          console.log('Existing user found - proceeding to home');
          this.sessionState.startSession();
          await this.router.navigate(['/home']);
          return;
        }
        
        // Si el usuario no existe o no tiene nombre de usuario, crear/actualizar documento
        const userData = {
          uid: credential.user.uid,
          email: credential.user.email || '',  
          firstName: credential.user.displayName?.split(' ')[0] || '',
          lastName: credential.user.displayName?.split(' ').slice(1).join(' ') || '',
          username: existingUser?.username || '', 
          isAdmin: existingUser?.isAdmin || false
        } as User;  
        
        console.log('Creating/updating user document:', userData);
        await this.updateUserData(credential.user, userData);
        
        // Si no hay nombre de usuario, redirigir a la configuración del perfil
        if (!userData.username) {
          console.log('Username needed - redirecting to profile setup');
          sessionStorage.setItem('googleSignUpData', JSON.stringify(userData));
          await this.router.navigate(['/signup'], { 
            queryParams: { 
              source: 'google',
              email: credential.user.email 
            }
          });
          return;
        }
        
        console.log('User setup complete - proceeding to home');
        this.sessionState.startSession();
        await this.router.navigate(['/home']);
      }
    } catch (error: any) {
      console.error('Full error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Current hostname:', window.location.hostname);
      console.error('Current origin:', window.location.origin);
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Inicio de sesión cancelado. Por favor intenta de nuevo.');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('El navegador bloqueó la ventana emergente. Por favor permite ventanas emergentes e intenta de nuevo.');
      } else if (error.code === 'auth/unauthorized-domain') {
        throw new Error('Este dominio no está autorizado para iniciar sesión con Google. Por favor contacta al administrador.');
      } else {
        throw new Error(`Error al iniciar sesión: ${error.message}`);
      }
    }
  }

  async completeGoogleSignUp(username: string): Promise<void> {
    const googleData = sessionStorage.getItem('googleSignUpData');
    if (!googleData) {
      throw new Error('No Google sign-up data found');
    }

    const { uid, email, firstName, lastName } = JSON.parse(googleData);
    
    try {
      await this.updateUserData({ uid, email }, {
        firstName,
        lastName,
        username,
        isAdmin: false
      });
      
      sessionStorage.removeItem('googleSignUpData');
      this.sessionState.startSession();
    } catch (error) {
      console.error('Error completing Google sign-up:', error);
      throw error;
    }
  }

  private async updateUserData(user: any, additionalData?: Partial<User>): Promise<void> {
    try {
      if (!user?.uid) {
        console.error('No user UID provided');
        return;
      }

      const userData: User = {
        uid: user.uid,
        email: user.email || '',
        firstName: additionalData?.firstName || user.displayName?.split(' ')[0] || '',
        lastName: additionalData?.lastName || user.displayName?.split(' ').slice(1).join(' ') || '',
        username: additionalData?.username || '',
        isAdmin: additionalData?.isAdmin || false
      };

      // Only remove undefined values, keep empty strings
      const cleanedUserData = Object.fromEntries(
        Object.entries(userData).filter(([_, v]) => v !== undefined)
      );

      console.log('Saving user data to Firestore:', cleanedUserData);
      await this.afs.doc(`users/${user.uid}`).set(cleanedUserData, { merge: true });
      console.log('Successfully saved user data');
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  private async updateAuthData(user: any): Promise<void> {
    if (!user?.uid) return;
    const userDoc = await this.afs.doc(`users/${user.uid}`).get().toPromise();
    if (!userDoc?.exists) {
      await this.updateUserData(user);
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