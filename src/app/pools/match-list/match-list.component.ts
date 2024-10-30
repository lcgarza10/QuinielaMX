import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Match } from '../../services/football.service';

interface PredictionMatch extends Match {
  prediction?: {
    homeScore: number | null;
    awayScore: number | null;
  };
}

@Component({
  selector: 'app-match-list',
  templateUrl: './match-list.component.html',
  styleUrls: ['./match-list.component.scss']
})
export class MatchListComponent {
  @Input() matches: PredictionMatch[] = [];
  @Input() isCompleted: boolean = false;
  @Input() weeklyPoints: number = 0;
  @Input() weekLabel: string = '';
  @Output() submitPredictions = new EventEmitter<void>();

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getMatchStatus(match: Match): string {
    if (match.status.short === 'LIVE') {
      return `En Curso ${match.status.elapsed}'`;
    }
    
    if (match.status.short === 'HT') {
      return 'Medio Tiempo';
    }
    
    if (match.status.short === 'FT') {
      return 'Finalizado';
    }
    
    if (match.status.short === 'NS') {
      const matchDate = new Date(match.date);
      const now = new Date();
      const diffMinutes = Math.floor((matchDate.getTime() - now.getTime()) / (1000 * 60));
      
      if (diffMinutes <= 60 && diffMinutes > 0) {
        return `Comienza en ${diffMinutes} min`;
      } else if (diffMinutes <= 0) {
        return 'A punto de comenzar';
      } else if (diffMinutes <= 120) {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        return `Comienza en ${hours}h ${mins}m`;
      } else {
        return this.formatMatchTime(matchDate);
      }
    }
    
    return match.status.long || 'Pendiente';
  }

  private formatMatchTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  getPredictionClass(match: PredictionMatch): string {
    const points = this.getMatchPoints(match);
    if (points === 3) return 'exact-match';
    if (points === 1) return 'partial-match';
    return 'no-match';
  }

  getMatchPoints(match: PredictionMatch): number {
    if (!match.prediction?.homeScore || !match.prediction?.awayScore || 
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    if (match.homeScore === match.prediction.homeScore && 
        match.awayScore === match.prediction.awayScore) {
      return 3;
    }

    const actualResult = Math.sign((match.homeScore || 0) - (match.awayScore || 0));
    const predictedResult = Math.sign(match.prediction.homeScore - match.prediction.awayScore);
    if (actualResult === predictedResult) {
      return 1;
    }

    return 0;
  }

  onSubmit(): void {
    this.submitPredictions.emit();
  }
}