import { Component, OnInit } from '@angular/core';
import { FootballService, Match } from '../services/football.service';
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

interface PointsMatch extends Match {
  predictedHomeScore?: number | null;
  predictedAwayScore?: number | null;
  points: number;
}

@Component({
  selector: 'app-points',
  templateUrl: './points.component.html',
  styleUrls: ['./points.component.scss']
})
export class PointsComponent implements OnInit {
  matches: PointsMatch[] = [];
  loading: boolean = true;
  error: string | null = null;
  selectedRound: string = '1';
  currentRound: number = 1;
  rounds: string[] = [
    ...Array.from({ length: 17 }, (_, i) => (i + 1).toString()),
    'Reclasificación',
    'Cuartos de Final',
    'Semifinal',
    'Final'
  ];
  userId: string | null = null;
  isOffline: boolean = false;
  totalPoints: number = 0;
  isLiveRound: boolean = false;
  isRoundFinished: boolean = false;

  constructor(
    private footballService: FootballService,
    private databaseService: DatabaseService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(async user => {
      this.userId = user ? user.uid : null;
      if (this.userId) {
        await this.findCurrentRound();
      } else {
        this.error = 'Usuario no autenticado';
        this.loading = false;
      }
    });
  }

  private async findCurrentRound() {
    this.loading = true;
    try {
      const currentRound = await this.footballService.getCurrentRound();
      this.currentRound = currentRound;
      this.selectedRound = currentRound.toString();
      await this.loadMatches();
    } catch (error) {
      console.error('Error finding current round:', error);
      this.loading = false;
      this.error = 'Error al cargar la jornada actual';
    }
  }

  onRoundChange(round: string) {
    this.selectedRound = round;
    this.loadMatches();
  }

  async loadMatches() {
    this.loading = true;
    this.error = null;

    if (this.userId) {
      try {
        const matches = await firstValueFrom(this.footballService.getMatches(parseInt(this.selectedRound)));
        const predictions = await firstValueFrom(this.databaseService.getPredictions(this.userId, this.selectedRound));
        
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

        this.matches = matches.map(match => {
          const prediction = predictions.find((p: any) => p.matchId === match.id);
          const pointsMatch: PointsMatch = {
            ...match,
            predictedHomeScore: prediction?.homeScore ?? null,
            predictedAwayScore: prediction?.awayScore ?? null,
            points: this.calculatePoints(match, prediction)
          };
          return pointsMatch;
        });

        this.totalPoints = this.matches.reduce((sum, match) => sum + match.points, 0);
        this.loading = false;
        this.isOffline = false;

        if (this.matches.length === 0) {
          this.error = 'No hay partidos para la jornada seleccionada.';
        }
      } catch (error) {
        console.error('Error fetching matches or predictions:', error);
        this.isOffline = true;
        await this.showOfflineAlert();
        this.error = 'Error al cargar los datos. Por favor intente nuevamente.';
        this.loading = false;
      }
    } else {
      this.error = 'Usuario no autenticado';
      this.loading = false;
    }
  }

  calculatePoints(match: Match, prediction: any): number {
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null ||
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    const homeScore = match.homeScore as number;
    const awayScore = match.awayScore as number;

    if (homeScore === prediction.homeScore && awayScore === prediction.awayScore) {
      return 3; // Exact score prediction
    }

    const actualResult = Math.sign(homeScore - awayScore);
    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);

    if (actualResult === predictedResult) {
      return 1; // Correct winner or tie
    }

    return 0; // Incorrect prediction
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

  async showOfflineAlert() {
    const alert = await this.alertController.create({
      header: 'Modo Sin Conexión',
      message: 'Actualmente está sin conexión. Algunas funciones pueden estar limitadas.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async retryConnection() {
    const toast = await this.toastController.create({
      message: 'Intentando reconectar...',
      duration: 2000
    });
    await toast.present();
    await this.loadMatches();
  }
}