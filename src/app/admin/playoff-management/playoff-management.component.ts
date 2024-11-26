import { Component, OnInit } from '@angular/core';
import { FootballService, PlayoffMatch } from '../../services/football.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-playoff-management',
  templateUrl: './playoff-management.component.html',
  styleUrls: ['./playoff-management.component.scss']
})
export class PlayoffManagementComponent implements OnInit {
  loading = false;
  playoffMatches: PlayoffMatch[] = [];
  playoffRounds = [
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];

  constructor(private footballService: FootballService) {}

  async ngOnInit() {
    await this.loadPlayoffMatches();
  }

  async loadPlayoffMatches() {
    try {
      this.loading = true;
      const matches = await firstValueFrom(this.footballService.getPlayoffMatches());
      this.playoffMatches = matches.sort((a, b) => {
        const roundOrder = this.playoffRounds.indexOf(a.round) - this.playoffRounds.indexOf(b.round);
        if (roundOrder !== 0) return roundOrder;
        if (a.leg !== b.leg) return (a.leg || 0) - (b.leg || 0);
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    } catch (error) {
      console.error('Error loading playoff matches:', error);
    } finally {
      this.loading = false;
    }
  }

  getMatchStatus(match: PlayoffMatch): string {
    return match.status.short === 'FT' ? 'Finalizado' : 'Pendiente';
  }

  getStatusColor(match: PlayoffMatch): string {
    return match.status.short === 'FT' ? 'success' : 'warning';
  }
}