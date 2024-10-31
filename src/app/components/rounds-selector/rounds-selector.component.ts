import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-rounds-selector',
  templateUrl: './rounds-selector.component.html',
  styleUrls: ['./rounds-selector.component.scss']
})
export class RoundsSelectorComponent {
  @Input() selectedRound: number = 1;
  @Input() currentRound: number = 1;
  @Input() isLiveRound: boolean = false;
  @Input() rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  @Output() roundChange = new EventEmitter<number>();

  onRoundChange(round: number) {
    this.roundChange.emit(round);
  }
}