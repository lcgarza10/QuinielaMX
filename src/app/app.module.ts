import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ServiceWorkerModule } from '@angular/service-worker';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireFunctionsModule } from '@angular/fire/compat/functions';
import { AngularFireAnalyticsModule, ScreenTrackingService, UserTrackingService } from '@angular/fire/compat/analytics';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';

registerLocaleData(es);

import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { LayoutComponent } from './components/layout/layout.component';
import { UserMenuComponent } from './components/user-menu/user-menu.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { HomeComponent } from './home/home.component';
import { ScoresComponent } from './scores/scores.component';
import { PoolsComponent } from './pools/pools.component';
import { GroupManagementComponent } from './admin/group-management/group-management.component';
import { RegistrationFormComponent } from './components/registration-form/registration-form.component';
import { RoundsSelectorComponent } from './components/rounds-selector/rounds-selector.component';
import { TeamFormComponent } from './components/team-form/team-form.component';
import { TestPredictionsComponent } from './admin/test-predictions/test-predictions.component';
import { SeasonManagementComponent } from './admin/season-management/season-management.component';
import { PointsComponent } from './points/points.component';
import { UserListComponent } from './user-list/user-list.component';
import { PlayoffManagementComponent } from './admin/playoff-management/playoff-management.component';
import { MatchPredictionComponent } from './pools/match-prediction/match-prediction.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { PlayoffRoundPipe } from './pipes/playoff-round.pipe';

import { FootballService } from './services/football.service';
import { DatabaseService } from './services/database.service';
import { AuthService } from './services/auth.service';
import { ConnectionService } from './services/connection.service';
import { FirebaseRetryService } from './services/firebase-retry.service';
import { SeasonService } from './services/season.service';
import { GroupService } from './services/group.service';
import { InvitationService } from './services/invitation.service';
import { PlatformService } from './services/platform.service';
import { ThemeService } from './services/theme.service';
import { SessionService } from './services/session.service';
import { NoAuthGuard } from './services/no-auth.guard';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    SignupComponent,
    HomeComponent,
    ScoresComponent,
    PoolsComponent,
    GroupManagementComponent,
    RegistrationFormComponent,
    RoundsSelectorComponent,
    TeamFormComponent,
    TestPredictionsComponent,
    SeasonManagementComponent,
    PointsComponent,
    UserListComponent,
    PlayoffManagementComponent,
    MatchPredictionComponent,
    LeaderboardComponent,
    LayoutComponent,
    UserMenuComponent,
    PlayoffRoundPipe
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    }),
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule.enablePersistence({
      synchronizeTabs: true
    }),
    AngularFireFunctionsModule,
    AngularFireAnalyticsModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    FootballService,
    DatabaseService,
    AuthService,
    ConnectionService,
    FirebaseRetryService,
    SeasonService,
    GroupService,
    InvitationService,
    PlatformService,
    ThemeService,
    SessionService,
    NoAuthGuard,
    ScreenTrackingService,
    UserTrackingService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }