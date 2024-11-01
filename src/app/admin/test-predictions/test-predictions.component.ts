import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { SeasonService } from '../../services/season.service';
import { FootballService, Match } from '../../services/football.service';
import { ToastController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

interface UserData {
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

@Component({
  selector: 'app-test-predictions',
  templateUrl: './test-predictions.component.html',
  styleUrls: ['./test-predictions.component.scss']
})
export class TestPredictionsComponent implements OnInit {
  loading = false;
  currentSeason: any = null;

  constructor(
    private databaseService: DatabaseService,
    private seasonService: SeasonService,
    private footballService: FootballService,
    private toastController: ToastController,
    private alertController: AlertController,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore
  ) {}

  ngOnInit() {
    this.loadCurrentSeason();
  }

  async loadCurrentSeason() {
    try {
      this.currentSeason = await firstValueFrom(this.seasonService.getActiveSeason());
    } catch (error) {
      console.error('Error loading current season:', error);
    }
  }

  async clearPredictions() {
    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: '¿Estás seguro de que deseas eliminar todas las predicciones? Esta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            this.loading = true;
            try {
              const usersSnapshot = await this.afs.collection('users').get().toPromise();
              const batch = this.afs.firestore.batch();
              
              if (usersSnapshot) {
                for (const userDoc of usersSnapshot.docs) {
                  const weeksSnapshot = await this.afs.collection(`predictions/${userDoc.id}/weeks`).get().toPromise();
                  weeksSnapshot?.docs.forEach(weekDoc => {
                    batch.delete(weekDoc.ref);
                  });
                }
              }

              await batch.commit();

              const toast = await this.toastController.create({
                message: 'Predicciones eliminadas exitosamente',
                duration: 2000,
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Error clearing predictions:', error);
              const toast = await this.toastController.create({
                message: 'Error al eliminar las predicciones',
                duration: 2000,
                color: 'danger'
              });
              await toast.present();
            } finally {
              this.loading = false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async generateRandomPredictions() {
    const alert = await this.alertController.create({
      header: 'Confirmar generación',
      message: '¿Estás seguro de que deseas generar predicciones aleatorias para partidos pasados?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Generar',
          handler: async () => {
            this.loading = true;
            try {
              const currentRound = await this.footballService.getCurrentRound();
              const usersSnapshot = await this.afs.collection('users').get().toPromise();
              const batch = this.afs.firestore.batch();

              // Get all matches up to current round
              const allPastMatches: { [key: number]: Match[] } = {};
              for (let week = 1; week <= currentRound; week++) {
                const matches = await firstValueFrom(this.footballService.getMatches(week));
                const pastMatches = matches.filter(match => {
                  const matchDate = new Date(match.date);
                  const now = new Date();
                  return matchDate < now;
                });
                if (pastMatches.length > 0) {
                  allPastMatches[week] = pastMatches;
                }
              }

              usersSnapshot?.docs.forEach(doc => {
                Object.entries(allPastMatches).forEach(([week, matches]) => {
                  const predictions = this.generatePredictionsForMatches(matches);
                  if (predictions.length > 0) {
                    const weekRef = this.afs.doc(`predictions/${doc.id}/weeks/${week}`).ref;
                    batch.set(weekRef, {
                      predictions,
                      totalPoints: 0,
                      lastUpdated: firebase.firestore.Timestamp.now()
                    }, { merge: true });
                  }
                });
              });

              await batch.commit();

              const toast = await this.toastController.create({
                message: 'Predicciones aleatorias generadas exitosamente para partidos pasados',
                duration: 2000,
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Error generating predictions:', error);
              const toast = await this.toastController.create({
                message: 'Error al generar predicciones aleatorias',
                duration: 2000,
                color: 'danger'
              });
              await toast.present();
            } finally {
              this.loading = false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private generatePredictionsForMatches(matches: Match[]) {
    return matches.map(match => ({
      matchId: match.id,
      homeScore: Math.floor(Math.random() * 4),
      awayScore: Math.floor(Math.random() * 4),
      points: 0
    }));
  }

  async resetPasswords() {
    const alert = await this.alertController.create({
      header: 'Confirmar reseteo',
      message: '¿Estás seguro de que deseas resetear las contraseñas de todos los usuarios?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Resetear',
          handler: async () => {
            this.loading = true;
            try {
              const usersSnapshot = await this.afs.collection<UserData>('users').get().toPromise();
              const promises = usersSnapshot?.docs.map(async doc => {
                const userData = doc.data();
                if (userData.email) {
                  await this.afAuth.sendPasswordResetEmail(userData.email);
                }
              });

              if (promises) {
                await Promise.all(promises);
              }

              const toast = await this.toastController.create({
                message: 'Correos de reseteo de contraseña enviados exitosamente',
                duration: 2000,
                color: 'success'
              });
              await toast.present();
            } catch (error) {
              console.error('Error resetting passwords:', error);
              const toast = await this.toastController.create({
                message: 'Error al resetear las contraseñas',
                duration: 2000,
                color: 'danger'
              });
              await toast.present();
            } finally {
              this.loading = false;
            }
          }
        }
      ]
    });
    await alert.present();
  }
}