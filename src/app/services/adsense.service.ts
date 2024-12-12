import { Injectable, NgZone } from '@angular/core';

interface Window {
  adsbygoogle: any[];
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

@Injectable({
  providedIn: 'root'
})
export class AdsenseService {
  private adsbygoogle: any[];

  constructor(private ngZone: NgZone) {
    // Initialize adsbygoogle array if it doesn't exist
    (window as any).adsbygoogle = (window as any).adsbygoogle || [];
    this.adsbygoogle = (window as any).adsbygoogle;
  }

  /**
   * Push a new ad to be displayed
   * @param adSlot The ad slot element
   */
  pushAd(adSlot: HTMLElement): void {
    this.ngZone.runOutsideAngular(() => {
      try {
        this.adsbygoogle.push({});
        console.log('Ad pushed successfully');
      } catch (error) {
        console.error('Error pushing ad:', error);
      }
    });
  }
}
