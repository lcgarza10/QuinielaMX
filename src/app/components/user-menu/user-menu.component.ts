import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-user-menu',
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss']
})
export class UserMenuComponent {
  @Input() email: string = '';
  isDark: boolean;

  constructor(
    private popoverController: PopoverController,
    private themeService: ThemeService
  ) {
    this.isDark = this.themeService.isDarkMode();
  }

  dismiss(action?: string) {
    this.popoverController.dismiss({
      action: action
    });
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    this.dismiss('toggle-theme');
  }

  logout() {
    this.dismiss('logout');
  }
}
