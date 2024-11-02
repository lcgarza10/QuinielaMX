import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PlatformInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentBreakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  private platformInfo = new BehaviorSubject<PlatformInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    currentBreakpoint: 'md'
  });

  constructor(private platform: Platform) {
    this.detectPlatform();
    this.setupResizeListener();
  }

  private detectPlatform() {
    const width = window.innerWidth;
    const info: PlatformInfo = {
      isMobile: this.platform.is('mobile') || width < 768,
      isTablet: this.platform.is('tablet') || (width >= 768 && width < 1024),
      isDesktop: this.platform.is('desktop') || width >= 1024,
      currentBreakpoint: this.getCurrentBreakpoint(width)
    };
    this.platformInfo.next(info);
  }

  private getCurrentBreakpoint(width: number): 'xs' | 'sm' | 'md' | 'lg' | 'xl' {
    if (width < 576) return 'xs';
    if (width < 768) return 'sm';
    if (width < 992) return 'md';
    if (width < 1200) return 'lg';
    return 'xl';
  }

  private setupResizeListener() {
    window.addEventListener('resize', () => {
      this.detectPlatform();
    });
  }

  getPlatformInfo(): Observable<PlatformInfo> {
    return this.platformInfo.asObservable();
  }
}