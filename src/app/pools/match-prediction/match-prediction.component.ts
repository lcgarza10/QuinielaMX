import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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
export class MatchPredictionComponent implements OnInit {
  @Input() match!: Match;
  @Input() prediction!: PredictionData;
  @Input() canPredict: boolean = false;
  @Input() canEdit: boolean = false;
  @Input() isCompleted: boolean = false;
  @Output() predictionChange = new EventEmitter<PredictionData>();

  ngOnInit() {
    // Only initialize predictions for matches that can be predicted
    if (this.prediction && this.canPredict) {
      if (this.prediction.homeScore === null) {
        this.prediction.homeScore = 0;
      }
      if (this.prediction.awayScore === null) {
        this.prediction.awayScore = 0;
      }
      // Emit initial values only for predictable matches
      this.predictionChange.emit(this.prediction);
    }
  }

  getScoreClass(): string {
    if (!this.isCompleted) {
      if (this.match.status.short === 'NS' || this.match.status.short === 'TBD') {
        return 'not-started';
      }
      return '';
    }
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

  incrementScore(team: 'home' | 'away') {
    if (!this.canPredict && !this.canEdit) return;
    
    if (team === 'home') {
      this.prediction.homeScore = (this.prediction.homeScore ?? 0) + 1;
    } else {
      this.prediction.awayScore = (this.prediction.awayScore ?? 0) + 1;
    }
    this.onScoreChange();
  }

  decrementScore(team: 'home' | 'away') {
    if (!this.canPredict && !this.canEdit) return;
    
    if (team === 'home' && (this.prediction.homeScore ?? 0) > 0) {
      this.prediction.homeScore = (this.prediction.homeScore ?? 1) - 1;
    } else if (team === 'away' && (this.prediction.awayScore ?? 0) > 0) {
      this.prediction.awayScore = (this.prediction.awayScore ?? 1) - 1;
    }
    this.onScoreChange();
  }

  setQuickScore(home: number, away: number) {
    if (!this.canPredict && !this.canEdit) return;
    
    this.prediction.homeScore = home;
    this.prediction.awayScore = away;
    this.onScoreChange();
  }

  shouldShowScoreInput(): boolean {
    // Show score input if:
    // 1. Match hasn't been predicted yet and can be predicted
    // 2. OR it's a playoff match that hasn't started yet (can be edited)
    return (!this.isCompleted && this.canPredict) || this.canEdit;
  }

  shouldShowScoreDisplay(): boolean {
    // Show score display if:
    // 1. Predictions are completed
    // 2. AND it's not editable
    return this.isCompleted && !this.canEdit;
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
    if (this.canPredict || this.canEdit) {
      this.predictionChange.emit(this.prediction);
    }
  }
}