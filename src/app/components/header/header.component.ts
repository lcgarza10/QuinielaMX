import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { Observable } from 'rxjs';
import { User } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  showBackButton: boolean = true;
  user$: Observable<User | null>;
  isDarkMode: boolean;

  constructor(
    public authService: AuthService,
    private router: Router,
    private themeService: ThemeService
  ) {
    this.user$ = this.authService.user$;
    this.isDarkMode = this.themeService.isDarkMode();
    
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.showBackButton = !event.urlAfterRedirects.includes('/home');
      }
    });
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.themeService.setTheme(this.isDarkMode);
  }

  async logout() {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}