import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PopoverController } from '@ionic/angular';
import { ThemeService } from '../../services/theme.service';
import { UserMenuComponent } from '../user-menu/user-menu.component';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent {
  isAdmin: boolean = false;
  isAuthenticated: boolean = false;
  userEmail: string = '';
  username: string = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private popoverController: PopoverController,
    private themeService: ThemeService
  ) {
    this.authService.user$.subscribe(user => {
      this.isAdmin = this.authService.isAdmin(user);
      this.isAuthenticated = !!user;
      this.userEmail = user?.email || '';
      this.username = user?.username || user?.email?.split('@')[0] || 'Perfil';
    });
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  async presentUserMenu(ev: any) {
    const popover = await this.popoverController.create({
      component: UserMenuComponent,
      event: ev,
      componentProps: {
        email: this.userEmail
      },
      translucent: true
    });
    await popover.present();

    const { data } = await popover.onDidDismiss();
    if (data) {
      switch (data.action) {
        case 'logout':
          this.authService.signOut();
          this.router.navigate(['/login']);
          break;
        case 'toggle-theme':
          this.themeService.toggleTheme();
          break;
      }
    }
  }
}
