import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { GroupManagementComponent } from './group-management/group-management.component';
import { PlayoffManagementComponent } from './playoff-management/playoff-management.component';
import { SeasonManagementComponent } from './season-management/season-management.component';
import { TestPredictionsComponent } from './test-predictions/test-predictions.component';
import { PointsManagementComponent } from './points-management/points-management.component';

const routes: Routes = [
  { path: 'groups', component: GroupManagementComponent },
  { path: 'playoffs', component: PlayoffManagementComponent },
  { path: 'seasons', component: SeasonManagementComponent },
  { path: 'test', component: TestPredictionsComponent },
  { path: 'points', component: PointsManagementComponent },
  { path: '', redirectTo: 'points', pathMatch: 'full' }
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterModule.forChild(routes)
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
