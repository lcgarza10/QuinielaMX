import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { Observable } from 'rxjs';
import { User } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  showBackButton: boolean = true;
  user$: Observable<User | null>;

  constructor(
    public authService: AuthService,
    private router: Router
  ) {
    this.user$ = this.authService.user$;
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Hide back button on home page
        this.showBackButton = !event.urlAfterRedirects.includes('/home');
      }
    });
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