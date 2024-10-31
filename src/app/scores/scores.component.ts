import { Component, OnInit } from '@angular/core';
import { FootballService, Match } from '../services/football.service';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-scores',
  templateUrl: './scores.component.html',
  styleUrls: ['./scores.component.scss']
})
export class ScoresComponent implements OnInit {
  matches: Match[] = [];
  loading: boolean = true;
  error: string | null = null;
  selectedRound: number = 1;
  currentRound: number = 1;
  rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1);
  isRateLimited: boolean = false;
  isLiveRound: boolean = false;
  isRoundFinished: boolean = false;

  constructor(
    private footballService: FootballService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.findCurrentRound();
  }

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      this.selectedRound = currentRound;
      await this.loadMatches();
    } catch (error) {
      console.error('Error finding current round:', error);
      this.loading = false;
      this.error = 'Error al cargar la jornada actual';
    }
  }

  async loadMatches() {
    this.loading = true;
    this.error = null;
    this.isRateLimited = false;

    try {
      const matches = await firstValueFrom(this.footballService.getMatches(this.selectedRound));
      this.matches = matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      this.isLiveRound = matches.some(match => 
        match.status.short === 'LIVE' || 
        match.status.short === 'HT'
      );

      const completedMatches = matches.filter(match => 
        match.status.short === 'FT' || 
        match.status.short === 'AET' || 
        match.status.short === 'PEN'
      );
      this.isRoundFinished = completedMatches.length === matches.length;
      
      if (this.matches.length === 0) {
        await this.showToast('No hay partidos programados para esta jornada', 'warning');
      }
    } catch (error: any) {
      console.error('Error loading matches:', error);
      
      if (error.error?.code === 2100) {
        this.isRateLimited = true;
        this.error = 'Se ha alcanzado el límite de la API. Los datos mostrados pueden no estar actualizados.';
        await this.showToast('Límite de API alcanzado. Se muestran datos en caché.', 'warning');
      } else {
        this.error = 'Error al cargar los partidos. Por favor intente nuevamente.';
        await this.showToast('Error al cargar los partidos', 'danger');
      }
    } finally {
      this.loading = false;
    }
  }

  onRoundChange(round: number) {
    this.selectedRound = round;
    this.loadMatches();
  }

  getRoundStatus(): string {
    if (this.isLiveRound) {
      return 'Jornada en curso';
    }
    if (this.isRoundFinished) {
      return 'Jornada finalizada';
    }
    return `Jornada ${this.selectedRound}`;
  }

  getMatchStatus(match: Match): string {
    if (match.status.short === 'LIVE') {
      return `En vivo ${match.status.elapsed}'`;
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
        return 'Por comenzar';
      } else if (diffMinutes <= 120) {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        return `Comienza en ${hours}h ${mins}m`;
      } else {
        return this.formatMatchTime(matchDate);
      }
    }
    
    return match.status.long || 'Programado';
  }

  private formatMatchTime(date: Date): string {
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}