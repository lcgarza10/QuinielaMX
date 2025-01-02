import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';

import { GroupManagementComponent } from './group-management/group-management.component';
import { PlayoffManagementComponent } from './playoff-management/playoff-management.component';
import { SeasonManagementComponent } from './season-management/season-management.component';
import { TestPredictionsComponent } from './test-predictions/test-predictions.component';
import { PointsManagementComponent } from './points-management/points-management.component';

const routes: Routes = [
  { path: 'test-predictions', component: TestPredictionsComponent },
  { path: 'season', component: SeasonManagementComponent },
  { path: 'groups', component: GroupManagementComponent },
  { path: 'points', component: PointsManagementComponent },
  { path: '', redirectTo: 'test-predictions', pathMatch: 'full' }
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    SharedModule
  ],
  declarations: [
    GroupManagementComponent,
    PlayoffManagementComponent,
    SeasonManagementComponent,
    TestPredictionsComponent,
    PointsManagementComponent
  ]
})
export class AdminModule { }
