import { Component, OnInit } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { GroupService, Group } from '../services/group.service';
import { User } from '../services/auth.service';
import { Observable, firstValueFrom } from 'rxjs';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnInit {
  users$: Observable<User[]>;
  loading: boolean = true;
  error: string | null = null;

  constructor(
    private databaseService: DatabaseService,
    private groupService: GroupService,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore
  ) {
    this.users$ = new Observable<User[]>();
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.error = null;
    this.users$ = this.databaseService.getAllUsers();
    this.users$.subscribe({
      next: (users) => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error al cargar usuarios. Por favor intente nuevamente.';
        console.error('Error loading users:', err);
      }
    });
  }

  async showUserGroups(user: User) {
    const groups = await firstValueFrom(this.groupService.getUserGroups());
    const userGroups = groups.filter(group => group.members.includes(user.uid));

    if (userGroups.length === 0) {
      const toast = await this.toastController.create({
        message: 'El usuario no pertenece a ningún grupo',
        duration: 2000,
        color: 'medium'
      });
      await toast.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Grupos del Usuario',
      message: 'Selecciona un grupo para remover al usuario',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    userGroups.forEach(group => {
      alert.buttons.push({
        text: group.name,
        handler: () => {
          this.confirmRemoveFromGroup(user, group);
        }
      });
    });

    await alert.present();
  }

  async confirmRemoveFromGroup(user: User, group: Group) {
    const alert = await this.alertController.create({
      header: 'Confirmar Acción',
      message: `¿Estás seguro de que deseas remover a ${user.username || user.email} del grupo ${group.name}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Remover',
          handler: async () => {
            await this.removeUserFromGroup(user, group);
          }
        }
      ]
    });

    await alert.present();
  }

  async removeUserFromGroup(user: User, group: Group) {
    const loading = await this.loadingController.create({
      message: 'Removiendo usuario del grupo...'
    });
    await loading.present();

    try {
      const batch = this.afs.firestore.batch();

      // Remove user from group members array
      const groupRef = this.afs.doc(`groups/${group.id}`).ref;
      batch.update(groupRef, {
        members: firebase.firestore.FieldValue.arrayRemove(user.uid),
        memberCount: firebase.firestore.FieldValue.increment(-1)
      });

      // Remove group from user's groups
      const userGroupRef = this.afs.doc(`users/${user.uid}/groups/${group.id}`).ref;
      batch.delete(userGroupRef);

      // Remove user from group members collection
      const memberRef = this.afs.doc(`groups/${group.id}/members/${user.uid}`).ref;
      batch.delete(memberRef);

      await batch.commit();

      const toast = await this.toastController.create({
        message: 'Usuario removido del grupo exitosamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Error removing user from group:', error);
      const toast = await this.toastController.create({
        message: 'Error al remover usuario del grupo',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async confirmDeleteUser(user: User) {
    const alert = await this.alertController.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que deseas eliminar al usuario ${user.username || user.email}? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            await this.deleteUser(user);
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteUser(user: User) {
    const loading = await this.loadingController.create({
      message: 'Eliminando usuario...'
    });
    await loading.present();

    try {
      const batch = this.afs.firestore.batch();

      // Delete user's predictions
      const predictionsSnapshot = await this.afs.collection(`predictions/${user.uid}/weeks`).get().toPromise();
      predictionsSnapshot?.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete user's points
      batch.delete(this.afs.doc(`userPoints/${user.uid}`).ref);

      // Remove user from all groups
      const userGroupsSnapshot = await this.afs.collection(`users/${user.uid}/groups`).get().toPromise();
      if (userGroupsSnapshot) {
        for (const groupDoc of userGroupsSnapshot.docs) {
          const groupId = groupDoc.id;
          const groupRef = this.afs.doc(`groups/${groupId}`).ref;
          batch.update(groupRef, {
            members: firebase.firestore.FieldValue.arrayRemove(user.uid),
            memberCount: firebase.firestore.FieldValue.increment(-1)
          });
          batch.delete(this.afs.doc(`groups/${groupId}/members/${user.uid}`).ref);
        }
      }

      // Delete user document
      batch.delete(this.afs.doc(`users/${user.uid}`).ref);

      await batch.commit();

      // Delete user authentication
      const userAuth = await this.afAuth.currentUser;
      if (userAuth) {
        await userAuth.delete();
      }

      const toast = await this.toastController.create({
        message: 'Usuario eliminado exitosamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();

      this.loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user:', error);
      const toast = await this.toastController.create({
        message: 'Error al eliminar usuario',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }
}