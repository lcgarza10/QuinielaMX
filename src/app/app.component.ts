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
import { PlatformService, PlatformInfo } from './services/platform.service';

@Component({
  selector: 'app-root',
  template: `
    <ion-app [class.mobile]="platformInfo?.isMobile"
             [class.tablet]="platformInfo?.isTablet"
             [class.desktop]="platformInfo?.isDesktop"
             [class.xs]="platformInfo?.currentBreakpoint === 'xs'"
             [class.sm]="platformInfo?.currentBreakpoint === 'sm'"
             [class.md]="platformInfo?.currentBreakpoint === 'md'"
             [class.lg]="platformInfo?.currentBreakpoint === 'lg'"
             [class.xl]="platformInfo?.currentBreakpoint === 'xl'">
      <app-header></app-header>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class AppComponent {
  platformInfo: PlatformInfo | null = null;

  constructor(
    private platform: Platform,
    private authService: AuthService,
    private connectionService: ConnectionService,
    private router: Router,
    private swUpdate: SwUpdate,
    private toastController: ToastController,
    private afs: AngularFirestore,
    private afAuth: AngularFireAuth,
    private afFunctions: AngularFireFunctions,
    private platformService: PlatformService
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.checkForUpdates();
      this.setupConnectionListener();
      this.setupAuthListener();
      this.setupPlatformListener();
    });
  }

  private setupPlatformListener() {
    this.platformService.getPlatformInfo().subscribe(info => {
      this.platformInfo = info;
      document.body.classList.toggle('mobile', info.isMobile);
      document.body.classList.toggle('tablet', info.isTablet);
      document.body.classList.toggle('desktop', info.isDesktop);
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