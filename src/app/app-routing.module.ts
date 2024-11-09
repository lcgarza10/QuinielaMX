import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { ScoresComponent } from './scores/scores.component';
import { PoolsComponent } from './pools/pools.component';
import { PointsComponent } from './points/points.component';
import { UserListComponent } from './user-list/user-list.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { TestPredictionsComponent } from './admin/test-predictions/test-predictions.component';
import { SeasonManagementComponent } from './admin/season-management/season-management.component';
import { GroupManagementComponent } from './admin/group-management/group-management.component';
import { AuthGuard } from './services/auth.guard';
import { AdminGuard } from './services/admin.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'scores', component: ScoresComponent, canActivate: [AuthGuard] },
  { path: 'pools', component: PoolsComponent, canActivate: [AuthGuard] },
  { path: 'points', component: PointsComponent, canActivate: [AuthGuard] },
  { path: 'user-list', component: UserListComponent, canActivate: [AuthGuard] },
  { path: 'leaderboard', component: LeaderboardComponent, canActivate: [AuthGuard] },
  { path: 'groups', component: GroupManagementComponent, canActivate: [AuthGuard] },
  { path: 'groups/join/:code', component: GroupManagementComponent, canActivate: [AuthGuard] },
  { 
    path: 'admin', 
    canActivate: [AuthGuard, AdminGuard],
    children: [
      { path: 'test-predictions', component: TestPredictionsComponent },
      { path: 'season', component: SeasonManagementComponent },
      { path: 'groups', component: GroupManagementComponent }
    ]
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }