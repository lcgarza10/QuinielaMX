import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { VersionService } from '../services/version.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  version: string;
  isAdmin: boolean = false;
  private userSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private versionService: VersionService,
    private authService: AuthService
  ) {
    this.version = this.versionService.getVersion();
  }

  ngOnInit() {
    this.userSubscription = this.authService.user$.subscribe(user => {
      this.isAdmin = this.authService.isAdmin(user);
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}