import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../../services/database.service';
import { SeasonService } from '../../services/season.service';
import { FootballService, Match } from '../../services/football.service';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

interface UserData {
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  isAdmin?: boolean;
}

interface Prediction {
  matchId: number;
  homeScore: number;
  awayScore: number;
  points?: number;
}

interface WeekData {
  totalPoints: number;
  predictions: Prediction[];
  lastUpdated: firebase.firestore.Timestamp;
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
    private loadingController: LoadingController,
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

  async recalculateAllPoints() {
    const alert = await this.alertController.create({
      header: 'Recalcular Todos los Puntos',
      message: '¿Estás seguro de que deseas recalcular los puntos de todas las jornadas para todos los usuarios?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Recalcular',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Recalculando puntos...'
            });
            await loading.present();

            try {
              // Get all users
              const usersSnapshot = await this.afs.collection('users').get().toPromise();
              let updatedCount = 0;
              let totalProcessed = 0;

              if (usersSnapshot) {
                const currentRound = await this.footballService.getCurrentRound();
                
                for (const userDoc of usersSnapshot.docs) {
                  totalProcessed++;
                  console.log(`Processing user ${totalProcessed}/${usersSnapshot.docs.length}: ${userDoc.id}`);

                  try {
                    let totalUserPoints = 0;

                    // Process each round up to current
                    for (let round = 1; round <= currentRound; round++) {
                      console.log(`Processing round ${round} for user ${userDoc.id}`);
                      
                      // Get matches for this round
                      const matches = await firstValueFrom(this.footballService.getMatches(round));
                      const finishedMatches = matches.filter(m => m.status.short === 'FT');
                      
                      // Get user's predictions for this round
                      const predictionDoc = await this.afs.doc(`predictions/${userDoc.id}/weeks/${round}`).get().toPromise();
                      
                      if (predictionDoc?.exists) {
                        const data = predictionDoc.data() as { predictions: Prediction[] };
                        
                        if (data?.predictions && Array.isArray(data.predictions)) {
                          let weeklyPoints = 0;
                          
                          // Calculate points for each prediction
                          const updatedPredictions = data.predictions.map(pred => {
                            const match = finishedMatches.find(m => m.id === pred.matchId);
                            let points = 0;

                            if (match && pred.homeScore !== null && pred.awayScore !== null) {
                              if (pred.homeScore === match.homeScore && 
                                  pred.awayScore === match.awayScore) {
                                points = 3;
                              } else {
                                const actualResult = Math.sign(match.homeScore! - match.awayScore!);
                                const predictedResult = Math.sign(pred.homeScore - pred.awayScore);
                                if (actualResult === predictedResult) {
                                  points = 1;
                                }
                              }
                            }

                            weeklyPoints += points;
                            return { ...pred, points };
                          });

                          // Update predictions document for this round
                          await predictionDoc.ref.update({
                            predictions: updatedPredictions,
                            totalPoints: weeklyPoints,
                            lastUpdated: firebase.firestore.Timestamp.now()
                          });

                          totalUserPoints += weeklyPoints;
                        }
                      }
                    }

                    // Update user's total points
                    await this.afs.doc(`userPoints/${userDoc.id}`).set({
                      totalPoints: totalUserPoints,
                      lastUpdated: firebase.firestore.Timestamp.now()
                    }, { merge: true });

                    console.log(`Updated total points for user ${userDoc.id}: ${totalUserPoints}`);
                    updatedCount++;

                  } catch (error) {
                    console.error(`Error processing user ${userDoc.id}:`, error);
                  }
                }

                await this.showToast(
                  `Se actualizaron los puntos de ${updatedCount} usuarios de ${totalProcessed} totales`,
                  'success'
                );
              }
            } catch (error) {
              console.error('Error recalculating points:', error);
              await this.showToast(
                'Error al recalcular los puntos',
                'danger'
              );
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async recalculateRound16Points() {
    const alert = await this.alertController.create({
      header: 'Recalcular Puntos Jornada 16',
      message: '¿Estás seguro de que deseas recalcular los puntos de la jornada 16 para todos los usuarios?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Recalcular',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Recalculando puntos...'
            });
            await loading.present();

            try {
              // Get round 16 matches first
              console.log('Fetching round 16 matches...');
              const matches = await firstValueFrom(this.footballService.getMatches(16));
              const finishedMatches = matches.filter(m => m.status.short === 'FT');
              console.log(`Found ${finishedMatches.length} finished matches`);

              // Get all users
              const usersSnapshot = await this.afs.collection('users').get().toPromise();
              let updatedCount = 0;
              let totalProcessed = 0;

              if (usersSnapshot) {
                for (const userDoc of usersSnapshot.docs) {
                  totalProcessed++;
                  console.log(`Processing user ${totalProcessed}/${usersSnapshot.docs.length}: ${userDoc.id}`);

                  try {
                    // Get user's round 16 predictions
                    const predictionDoc = await this.afs.doc(`predictions/${userDoc.id}/weeks/16`).get().toPromise();
                    
                    if (predictionDoc?.exists) {
                      const data = predictionDoc.data() as { predictions: Prediction[] };
                      
                      if (data?.predictions && Array.isArray(data.predictions)) {
                        let weeklyPoints = 0;
                        
                        // Calculate points for each prediction
                        const updatedPredictions = data.predictions.map(pred => {
                          const match = finishedMatches.find(m => m.id === pred.matchId);
                          let points = 0;

                          if (match && pred.homeScore !== null && pred.awayScore !== null) {
                            console.log(`Match ${match.id}: ${match.homeScore}-${match.awayScore} vs Prediction: ${pred.homeScore}-${pred.awayScore}`);
                            
                            if (pred.homeScore === match.homeScore && 
                                pred.awayScore === match.awayScore) {
                              points = 3;
                              console.log('Exact match! 3 points');
                            } else {
                              const actualResult = Math.sign(match.homeScore! - match.awayScore!);
                              const predictedResult = Math.sign(pred.homeScore - pred.awayScore);
                              if (actualResult === predictedResult) {
                                points = 1;
                                console.log('Correct result! 1 point');
                              }
                            }
                          }

                          weeklyPoints += points;
                          return { ...pred, points };
                        });

                        console.log(`Total weekly points for user ${userDoc.id}: ${weeklyPoints}`);

                        // Update predictions document
                        await predictionDoc.ref.update({
                          predictions: updatedPredictions,
                          totalPoints: weeklyPoints,
                          lastUpdated: firebase.firestore.Timestamp.now()
                        });

                        // Update user's total points
                        const weeksSnapshot = await this.afs.collection(`predictions/${userDoc.id}/weeks`)
                          .get().toPromise();
                        
                        let totalPoints = 0;
                        if (weeksSnapshot) {
                          weeksSnapshot.docs.forEach(doc => {
                            if (doc.id === '16') {
                              totalPoints += weeklyPoints;
                            } else {
                              const weekData = doc.data() as WeekData;
                              totalPoints += weekData.totalPoints || 0;
                            }
                          });
                        }

                        console.log(`Updated total points for user ${userDoc.id}: ${totalPoints}`);

                        await this.afs.doc(`userPoints/${userDoc.id}`).set({
                          totalPoints,
                          lastUpdated: firebase.firestore.Timestamp.now()
                        }, { merge: true });

                        updatedCount++;
                      }
                    }
                  } catch (error) {
                    console.error(`Error processing user ${userDoc.id}:`, error);
                  }
                }

                await this.showToast(
                  `Se actualizaron los puntos de ${updatedCount} usuarios de ${totalProcessed} totales`,
                  'success'
                );
              }
            } catch (error) {
              console.error('Error recalculating points:', error);
              await this.showToast(
                'Error al recalcular los puntos',
                'danger'
              );
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async updateRound16Predictions() {
    const alert = await this.alertController.create({
      header: 'Confirmar actualización',
      message: '¿Estás seguro de que deseas actualizar las predicciones de la jornada 16 para agregar puntos iniciales?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Actualizar',
          handler: async () => {
            this.loading = true;
            try {
              // Get all users
              const usersSnapshot = await this.afs.collection('users').get().toPromise();
              const batch = this.afs.firestore.batch();
              let updatedCount = 0;

              if (usersSnapshot) {
                for (const userDoc of usersSnapshot.docs) {
                  // Check if user has predictions for round 16
                  const predictionDoc = await this.afs.doc(`predictions/${userDoc.id}/weeks/16`).get().toPromise();
                  
                  if (predictionDoc?.exists) {
                    const data = predictionDoc.data() as any;
                    if (data?.predictions && Array.isArray(data.predictions)) {
                      // Update each prediction to ensure it has points
                      const updatedPredictions = data.predictions.map((pred: Prediction) => ({
                        ...pred,
                        points: pred.points ?? 0 // Add points if not exists
                      }));

                      // Update the document
                      batch.update(predictionDoc.ref, {
                        predictions: updatedPredictions,
                        lastUpdated: firebase.firestore.Timestamp.now()
                      });
                      
                      updatedCount++;
                    }
                  }
                }
              }

              if (updatedCount > 0) {
                await batch.commit();
                await this.showToast(
                  `Se actualizaron las predicciones de ${updatedCount} usuarios para la jornada 16`,
                  'success'
                );
              } else {
                await this.showToast(
                  'No se encontraron predicciones para actualizar en la jornada 16',
                  'warning'
                );
              }
            } catch (error) {
              console.error('Error updating round 16 predictions:', error);
              await this.showToast(
                'Error al actualizar las predicciones de la jornada 16',
                'danger'
              );
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
                  const { predictions, totalPoints } = this.generatePredictionsForMatches(matches);
                  if (predictions.length > 0) {
                    const weekRef = this.afs.doc(`predictions/${doc.id}/weeks/${week}`).ref;
                    batch.set(weekRef, {
                      predictions,
                      totalPoints,
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

  async setAdminUser() {
    const alert = await this.alertController.create({
      header: 'Asignar Administrador',
      message: 'Ingresa el correo electrónico del usuario que deseas hacer administrador',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Correo electrónico'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Asignar',
          handler: async (data) => {
            if (!data.email) {
              this.showToast('Por favor ingresa un correo electrónico', 'warning');
              return false;
            }

            this.loading = true;
            try {
              const usersRef = this.afs.collection('users');
              const snapshot = await usersRef.ref.where('email', '==', data.email).get();

              if (snapshot.empty) {
                this.showToast('Usuario no encontrado', 'warning');
                return false;
              }

              const userDoc = snapshot.docs[0];
              await userDoc.ref.update({ isAdmin: true });

              this.showToast('Usuario actualizado como administrador', 'success');
              return true;
            } catch (error) {
              console.error('Error setting admin user:', error);
              this.showToast('Error al asignar administrador', 'danger');
              return false;
            } finally {
              this.loading = false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async syncPointsForAllUsers(round: string) {
    try {
      this.loading = true;
      await this.databaseService.syncPointsWithStandingsForAllUsers(round);
      this.presentToast('Puntos sincronizados exitosamente para todos los usuarios', 'success');
    } catch (error) {
      console.error('Error syncing points for all users:', error);
      this.presentToast('Error al sincronizar puntos', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async fixAllUsersPoints() {
    try {
      this.loading = true;
      await this.databaseService.fixAllUsersPoints();
      this.presentToast('Todos los puntos han sido corregidos para todos los usuarios', 'success');
    } catch (error) {
      console.error('Error fixing all users points:', error);
      this.presentToast('Error al corregir los puntos', 'danger');
    } finally {
      this.loading = false;
    }
  }

  private calculatePoints(prediction: Prediction, match: Match): number {
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null ||
        match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    if (prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore) {
      return 3; // Exact score
    }

    const actualResult = Math.sign(match.homeScore - match.awayScore);
    const predictedResult = Math.sign(prediction.homeScore - prediction.awayScore);
    if (actualResult === predictedResult) {
      return 1; // Correct winner or tie
    }

    return 0;
  }

  private generatePredictionsForMatches(matches: Match[]): { predictions: Prediction[], totalPoints: number } {
    const predictions = matches.map(match => {
      const prediction: Prediction = {
        matchId: match.id,
        homeScore: Math.floor(Math.random() * 4),
        awayScore: Math.floor(Math.random() * 4),
        points: 0 // Initialize points to 0
      };
      
      // Calculate points if match is finished
      if (match.status.short === 'FT') {
        prediction.points = this.calculatePoints(prediction, match);
      }

      return prediction;
    });

    // Calculate total points for this set of predictions
    const totalPoints = predictions.reduce((sum, pred) => sum + (pred.points || 0), 0);

    return { predictions, totalPoints };
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  private async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}