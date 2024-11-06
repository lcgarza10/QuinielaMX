import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { 
  AdMob, 
  BannerAdOptions, 
  BannerAdPosition, 
  BannerAdSize,
  InterstitialAdPluginEvents,
  AdMobBannerSize,
  BannerAdPluginEvents,
  AdMobError
} from '@capacitor-community/admob';

@Injectable({
  providedIn: 'root'
})
export class AdsService {
  private readonly bannerAdId = environment.production 
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY' // Replace with your production ad unit ID
    : 'ca-app-pub-3940256099942544/6300978111'; // Test ad unit ID

  private readonly interstitialAdId = environment.production
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ' // Replace with your production ad unit ID
    : 'ca-app-pub-3940256099942544/1033173712'; // Test ad unit ID

  private isInitialized = false;

  constructor(private platform: Platform) {
    this.setupAds();
  }

  async setupAds() {
    if (this.isInitialized) return;

    try {
      await AdMob.initialize({
        testingDevices: ['2077ef9a63d2b398840261c8221a0c9b'],
        initializeForTesting: !environment.production
      });

      AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
        console.log('Banner ad loaded');
      });

      AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error: AdMobError) => {
        console.error('Banner ad failed to load:', error);
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing AdMob:', error);
    }
  }

  async showBanner() {
    if (!this.isInitialized) {
      await this.setupAds();
    }

    const options: BannerAdOptions = {
      adId: this.bannerAdId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: !environment.production
    };

    try {
      await AdMob.showBanner(options);
    } catch (error) {
      console.error('Error showing banner ad:', error);
    }
  }

  async hideBanner() {
    try {
      await AdMob.removeBanner();
    } catch (error) {
      console.error('Error hiding banner ad:', error);
    }
  }

  async showInterstitial() {
    if (!this.isInitialized) {
      await this.setupAds();
    }

    try {
      await AdMob.prepareInterstitial({
        adId: this.interstitialAdId,
        isTesting: !environment.production
      });
      await AdMob.showInterstitial();
    } catch (error) {
      console.error('Error showing interstitial ad:', error);
    }
  }

  async resumeBanner() {
    try {
      await AdMob.resumeBanner();
    } catch (error) {
      console.error('Error resuming banner ad:', error);
    }
  }
}