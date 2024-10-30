import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { AuthService } from './services/auth.service';
import { ConnectionService } from './services/connection.service';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  template: `
    <ion-app>
      <app-header></app-header>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private authService: AuthService,
    private connectionService: ConnectionService,
    private router: Router,
    private swUpdate: SwUpdate,
    private toastController: ToastController,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private afFunctions: AngularFireFunctions
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.checkForUpdates();
      this.setupConnectionListener();
      this.setupAuthListener();
    });
  }

  private checkForUpdates() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.available.subscribe(() => {
        this.presentUpdateToast();
      });
    }
  }

  private async presentUpdateToast() {
    const toast = await this.toastController.create({
      message: 'A new version is available. Reload the page to update.',
      position: 'bottom',
      buttons: [
        {
          text: 'Reload',
          role: 'cancel',
          handler: () => {
            window.location.reload();
          }
        }
      ]
    });
    toast.present();
  }

  private setupConnectionListener() {
    this.connectionService.getOnlineStatus().subscribe(isOnline => {
      console.log('Connection status:', isOnline ? 'online' : 'offline');
    });
  }

  private setupAuthListener() {
    this.authService.user$.subscribe(user => {
      if (user) {
        console.log('User is logged in:', user);
      } else {
        console.log('User is not logged in');
        this.router.navigate(['/login']);
      }
    });
  }
}