import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { RegistrationFormComponent } from './components/registration-form/registration-form.component';
import { ScoresComponent } from './scores/scores.component';
import { PoolsComponent } from './pools/pools.component';
import { PointsComponent } from './points/points.component';
import { UserListComponent } from './user-list/user-list.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { TestPredictionsComponent } from './admin/test-predictions/test-predictions.component';
import { SeasonManagementComponent } from './admin/season-management/season-management.component';
import { GroupManagementComponent } from './admin/group-management/group-management.component';
import { PlayoffManagementComponent } from './admin/playoff-management/playoff-management.component';
import { AuthGuard } from './services/auth.guard';
import { AdminGuard } from './services/admin.guard';
import { NoAuthGuard } from './services/no-auth.guard';
import { LayoutComponent } from './components/layout/layout.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'login',
        component: LoginComponent,
        canActivate: [NoAuthGuard]
      },
      {
        path: 'signup',
        component: SignupComponent,
        canActivate: [NoAuthGuard]
      },
      {
        path: 'groups/join/:code',
        component: RegistrationFormComponent,
        canActivate: [NoAuthGuard]
      },
      {
        path: 'home',
        component: HomeComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'scores',
        component: ScoresComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'pools',
        component: PoolsComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'playoffs',
        component: PlayoffManagementComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'leaderboard',
        component: LeaderboardComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'groups',
        component: GroupManagementComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'admin',
        canActivate: [AuthGuard, AdminGuard],
        loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
      }
    ]
  },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }