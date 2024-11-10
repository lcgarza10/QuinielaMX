import { Component, OnInit } from '@angular/core';
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
import { AdsService } from './services/ads.service';
import { SessionService } from './services/session.service';
import { DatabaseService } from './services/database.service';
import { FootballService } from './services/football.service';
import { firstValueFrom } from 'rxjs';

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
export class AppComponent implements OnInit {
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
    private platformService: PlatformService,
    private adsService: AdsService,
    private sessionService: SessionService,
    private databaseService: DatabaseService,
    private footballService: FootballService
  ) {}

  async ngOnInit() {
    await this.initializeApp();
  }

  private async initializeApp() {
    await this.platform.ready();
    
    this.checkForUpdates();
    this.setupConnectionListener();
    this.setupAuthListener();
    this.setupPlatformListener();
    this.sessionService.initializeSession();
    
    await this.updateUserPoints();
    
    if (environment.production) {
      await this.adsService.setupAds();
      await this.adsService.showBanner();
    }
  }

  private async updateUserPoints() {
    const user = await firstValueFrom(this.authService.user$);
    if (user) {
      const currentRound = await this.footballService.getCurrentRound();
      await this.databaseService.updateMatchPoints(user.uid, currentRound.toString());
    }
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
    await toast.present();
  }

  private setupConnectionListener() {
    this.connectionService.getOnlineStatus().subscribe(isOnline => {
      console.log('Connection status:', isOnline ? 'online' : 'offline');
    });
  }

  private setupAuthListener() {
    this.authService.user$.subscribe(user => {
      if (!user) {
        this.router.navigate(['/login']);
      }
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
}