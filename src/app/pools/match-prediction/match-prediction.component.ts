import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Match } from '../../services/football.service';

export interface PredictionData {
  homeScore: number | null;
  awayScore: number | null;
}

@Component({
  selector: 'app-match-prediction',
  templateUrl: './match-prediction.component.html',
  styleUrls: ['./match-prediction.component.scss']
})
export class MatchPredictionComponent {
  @Input() match!: Match;
  @Input() prediction!: PredictionData;
  @Input() canPredict: boolean = false;
  @Input() isCompleted: boolean = false;
  @Output() predictionChange = new EventEmitter<PredictionData>();

  getScoreClass(): string {
    if (!this.isCompleted) return '';
    if (this.isExactMatch()) return 'exact-match';
    if (this.isPartialMatch()) return 'partial-match';
    return 'no-match';
  }

  getPoints(): number {
    if (!this.isCompleted) return 0;
    if (this.isExactMatch()) return 3;
    if (this.isPartialMatch()) return 1;
    return 0;
  }

  private isExactMatch(): boolean {
    return this.match.homeScore === this.prediction.homeScore && 
           this.match.awayScore === this.prediction.awayScore;
  }

  private isPartialMatch(): boolean {
    if (this.match.homeScore === null || this.match.awayScore === null ||
        this.prediction.homeScore === null || this.prediction.awayScore === null) {
      return false;
    }

    const actualResult = Math.sign(this.match.homeScore - this.match.awayScore);
    const predictedResult = Math.sign(this.prediction.homeScore - this.prediction.awayScore);
    return actualResult === predictedResult;
  }

  onScoreChange() {
    this.predictionChange.emit(this.prediction);
  }
}