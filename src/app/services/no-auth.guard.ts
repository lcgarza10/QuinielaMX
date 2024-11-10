import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NoAuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        if (!user) {
          // If there's an invite code in the route params, save it
          const inviteCode = route.paramMap.get('code');
          if (inviteCode) {
            // If we're not on the signup page, redirect to signup with the code
            if (!route.routeConfig?.path?.includes('signup')) {
              this.router.navigate(['/signup'], { queryParams: { code: inviteCode } });
              return false;
            }
          }
          return true;
        } else {
          this.router.navigate(['/home']);
          return false;
        }
      })
    );
  }
}