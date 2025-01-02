import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayoffRoundPipe } from '../pipes/playoff-round.pipe';

@NgModule({
  declarations: [
    PlayoffRoundPipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    PlayoffRoundPipe
  ]
})
export class SharedModule { }
