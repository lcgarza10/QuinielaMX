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
  selectedRound: number = 1;
  rounds: number[] = Array.from({ length: 17 }, (_, i) => i + 1); // Liga MX has 17 rounds
  userId: string | null = null;
  isOffline: boolean = false;
  totalPoints: number = 0;

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
        await this.loadMatches();
      } else {
        this.error = 'User not authenticated';
        this.loading = false;
      }
    });
  }

  onRoundChange() {
    this.loadMatches();
  }

  async loadMatches() {
    this.loading = true;
    this.error = null;

    if (this.userId) {
      try {
        const matches = await firstValueFrom(this.footballService.getMatches(this.selectedRound));
        const predictions = await firstValueFrom(this.databaseService.getPredictions(this.userId, this.selectedRound.toString()));
        
        console.log('Fetched matches:', matches);
        console.log('Fetched predictions:', predictions);

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

        console.log('Processed matches with predictions:', this.matches);

        this.totalPoints = this.matches.reduce((sum, match) => sum + match.points, 0);
        this.loading = false;
        this.isOffline = false;

        if (this.matches.length === 0) {
          this.error = 'No matches found for the selected round.';
        }
      } catch (error) {
        console.error('Error fetching matches or predictions:', error);
        this.isOffline = true;
        await this.showOfflineAlert();
        this.error = 'Failed to fetch data. Please try again.';
        this.loading = false;
      }
    } else {
      this.error = 'Invalid round selected or user not authenticated';
      this.loading = false;
    }
  }

  calculatePoints(match: Match, prediction: any): number {
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null ||
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    // Now we know both scores are not null
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

  async showOfflineAlert() {
    const alert = await this.alertController.create({
      header: 'Offline Mode',
      message: 'You are currently offline. Some features may be limited until you regain internet connectivity.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async retryConnection() {
    const toast = await this.toastController.create({
      message: 'Attempting to reconnect...',
      duration: 2000
    });
    await toast.present();
    await this.loadMatches();
  }
}