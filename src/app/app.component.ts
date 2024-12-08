import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { AuthService } from './services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { ToastController } from '@ionic/angular';
import { environment } from '../environments/environment';
import { PlatformService } from './services/platform.service';
import { AdsService } from './services/ads.service';
import { SessionService } from './services/session.service';
import { filter } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { 
  trophy, trophyOutline,
  football, footballOutline,
  podium, podiumOutline,
  people, peopleOutline,
  calendar, calendarOutline,
  globe, globeOutline,
  construct, constructOutline,
  warning, warningOutline,
  alert, alertOutline,
  checkmark, checkmarkOutline,
  radio, radioOutline,
  add, addOutline,
  remove, removeOutline,
  close, closeOutline,
  create, createOutline,
  person, personOutline,
  mail, mailOutline,
  lockClosed, lockClosedOutline,
  at, atOutline,
  logIn, logInOutline,
  logOut, logOutOutline,
  arrowForward, arrowForwardOutline,
  sunny, sunnyOutline,
  moon, moonOutline,
  share, shareOutline,
  shareSocial, shareSocialOutline,
  enter, enterOutline,
  key, keyOutline,
  save, saveOutline,
  refresh, refreshOutline,
  calculator, calculatorOutline,
  trash, trashOutline,
  shuffle, shuffleOutline
} from 'ionicons/icons';

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
  platformInfo: any = null;

  constructor(
    private platform: Platform,
    private authService: AuthService,
    private router: Router,
    private swUpdate: SwUpdate,
    private toastController: ToastController,
    private platformService: PlatformService,
    private adsService: AdsService,
    private sessionService: SessionService
  ) {
    // Add all Ionic icons
    addIcons({
      trophy, trophyOutline,
      football, footballOutline,
      podium, podiumOutline,
      people, peopleOutline,
      calendar, calendarOutline,
      globe, globeOutline,
      construct, constructOutline,
      warning, warningOutline,
      alert, alertOutline,
      checkmark, checkmarkOutline,
      radio, radioOutline,
      add, addOutline,
      remove, removeOutline,
      close, closeOutline,
      create, createOutline,
      person, personOutline,
      mail, mailOutline,
      lockClosed, lockClosedOutline,
      at, atOutline,
      logIn, logInOutline,
      logOut, logOutOutline,
      arrowForward, arrowForwardOutline,
      sunny, sunnyOutline,
      moon, moonOutline,
      share, shareOutline,
      shareSocial, shareSocialOutline,
      enter, enterOutline,
      key, keyOutline,
      save, saveOutline,
      refresh, refreshOutline,
      calculator, calculatorOutline,
      trash, trashOutline,
      shuffle, shuffleOutline
    });
  }

  async ngOnInit() {
    await this.initializeApp();
  }

  private async initializeApp() {
    await this.platform.ready();
    
    this.checkForUpdates();
    this.setupAuthListener();
    this.setupPlatformListener();
    this.setupSessionMonitoring();
    
    if (environment.production) {
      await this.adsService.setupAds();
      await this.adsService.showBanner();
    }
  }

  private setupSessionMonitoring() {
    // Monitor session status
    this.sessionService.getSessionStatus().subscribe(isActive => {
      if (!isActive && !this.router.url.includes('/login')) {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
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
    await toast.present();
  }

  private setupAuthListener() {
    this.authService.user$.subscribe(user => {
      if (!user && !this.router.url.includes('/login')) {
        this.router.navigate(['/login'], { replaceUrl: true });
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