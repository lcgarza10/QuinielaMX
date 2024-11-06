import { Component, OnInit, OnDestroy } from '@angular/core';
import { VersionService } from '../services/version.service';
import { AuthService } from '../services/auth.service';
import { AdsService } from '../services/ads.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  version: string;
  isAdmin: boolean = false;

  constructor(
    private versionService: VersionService,
    private authService: AuthService,
    private adsService: AdsService
  ) {
    this.version = this.versionService.getVersion();
    this.authService.user$.subscribe(user => {
      this.isAdmin = this.authService.isAdmin(user);
    });
  }

  async ngOnInit() {
    // Show banner ad when component loads
    await this.adsService.showBanner();
  }

  async ngOnDestroy() {
    // Hide banner ad when component is destroyed
    await this.adsService.hideBanner();
  }
}