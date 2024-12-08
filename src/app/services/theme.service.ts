import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(false);

  constructor() {
    this.loadTheme();
  }

  private loadTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const savedTheme = localStorage.getItem('darkMode');
    
    if (savedTheme !== null) {
      this.setTheme(savedTheme === 'true');
    } else {
      this.setTheme(prefersDark.matches);
    }

    // Listen for system theme changes
    prefersDark.addEventListener('change', (e) => {
      if (localStorage.getItem('darkMode') === null) {
        this.setTheme(e.matches);
      }
    });
  }

  setTheme(isDark: boolean) {
    this.darkMode.next(isDark);
    localStorage.setItem('darkMode', isDark.toString());
    
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  toggleTheme() {
    const currentTheme = this.isDarkMode();
    this.setTheme(!currentTheme);
  }

  isDarkMode(): boolean {
    return this.darkMode.value;
  }
}