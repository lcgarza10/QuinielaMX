import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ServiceWorkerModule } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es-MX';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  trophy, trophyOutline,
  football, footballOutline,
  podium, podiumOutline,
  people, peopleOutline,
  calendar, calendarOutline,
  globe, globeOutline,
  construct, constructOutline,
  warning, warningOutline,
  alert, alertOutline,
  checkmark, checkmarkOutline,
  radio, radioOutline,
  add, addOutline,
  remove, removeOutline,
  close, closeOutline,
  create, createOutline,
  person, personOutline,
  mail, mailOutline,
  lockClosed, lockClosedOutline,
  at, atOutline,
  logIn, logInOutline,
  logOut, logOutOutline,
  arrowForward, arrowForwardOutline,
  sunny, sunnyOutline,
  moon, moonOutline,
  share, shareOutline,
  shareSocial, shareSocialOutline,
  enter, enterOutline,
  key, keyOutline,
  save, saveOutline,
  refresh, refreshOutline,
  calculator, calculatorOutline,
  trash, trashOutline,
  shuffle, shuffleOutline
} from 'ionicons/icons';

import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { ScoresComponent } from './scores/scores.component';
import { PoolsComponent } from './pools/pools.component';
import { PointsComponent } from './points/points.component';
import { UserListComponent } from './user-list/user-list.component';
import { HeaderComponent } from './components/header/header.component';
import { RoundsSelectorComponent } from './components/rounds-selector/rounds-selector.component';
import { TeamFormComponent } from './components/team-form/team-form.component';
import { TestPredictionsComponent } from './admin/test-predictions/test-predictions.component';
import { SeasonManagementComponent } from './admin/season-management/season-management.component';
import { GroupManagementComponent } from './admin/group-management/group-management.component';
import { PlayoffManagementComponent } from './admin/playoff-management/playoff-management.component';
import { MatchPredictionComponent } from './pools/match-prediction/match-prediction.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { NoAuthGuard } from './services/no-auth.guard';
import { PlayoffRoundPipe } from './pipes/playoff-round.pipe';

import { FootballService } from './services/football.service';
import { DatabaseService } from './services/database.service';
import { AuthService } from './services/auth.service';
import { ConnectionService } from './services/connection.service';
import { FirebaseRetryService } from './services/firebase-retry.service';
import { SeasonService } from './services/season.service';
import { GroupService } from './services/group.service';
import { PlatformService } from './services/platform.service';
import { ThemeService } from './services/theme.service';
import { SessionService } from './services/session.service';
import { AppRoutingModule } from './app-routing.module';
import { environment } from '../environments/environment';

import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireFunctionsModule } from '@angular/fire/compat/functions';
import { AngularFireAnalyticsModule, ScreenTrackingService, UserTrackingService } from '@angular/fire/compat/analytics';

// Register Spanish (Mexico) locale
registerLocaleData(localeEs);

// Add all Ionic icons
addIcons({
  trophy, trophyOutline,
  football, footballOutline,
  podium, podiumOutline,
  people, peopleOutline,
  calendar, calendarOutline,
  globe, globeOutline,
  construct, constructOutline,
  warning, warningOutline,
  alert, alertOutline,
  checkmark, checkmarkOutline,
  radio, radioOutline,
  add, addOutline,
  remove, removeOutline,
  close, closeOutline,
  create, createOutline,
  person, personOutline,
  mail, mailOutline,
  lockClosed, lockClosedOutline,
  at, atOutline,
  logIn, logInOutline,
  logOut, logOutOutline,
  arrowForward, arrowForwardOutline,
  sunny, sunnyOutline,
  moon, moonOutline,
  share, shareOutline,
  shareSocial, shareSocialOutline,
  enter, enterOutline,
  key, keyOutline,
  save, saveOutline,
  refresh, refreshOutline,
  calculator, calculatorOutline,
  trash, trashOutline,
  shuffle, shuffleOutline
});

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    LoginComponent,
    SignupComponent,
    ScoresComponent,
    PoolsComponent,
    PointsComponent,
    UserListComponent,
    HeaderComponent,
    RoundsSelectorComponent,
    TeamFormComponent,
    TestPredictionsComponent,
    SeasonManagementComponent,
    GroupManagementComponent,
    PlayoffManagementComponent,
    MatchPredictionComponent,
    LeaderboardComponent,
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
    PlatformService,
    ThemeService,
    SessionService,
    NoAuthGuard,
    ScreenTrackingService,
    UserTrackingService
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule { }