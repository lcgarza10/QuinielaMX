import { Component } from '@angular/core';
import { VersionService } from '../services/version.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  version: string;
  isAdmin: boolean = false;

  constructor(
    private versionService: VersionService,
    private authService: AuthService
  ) {
    this.version = this.versionService.getVersion();
    this.authService.user$.subscribe(user => {
      this.isAdmin = this.authService.isAdmin(user);
    });
  }
}