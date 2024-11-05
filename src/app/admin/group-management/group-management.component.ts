import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GroupService, Group } from '../../services/group.service';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Observable, firstValueFrom, BehaviorSubject } from 'rxjs';
import { User } from '../../services/auth.service';
import { FootballService } from '../../services/football.service';
import { DatabaseService } from '../../services/database.service';

interface GroupMemberDisplay extends User {
  role: string;
  hasPredicted?: boolean;
}

@Component({
  selector: 'app-group-management',
  templateUrl: './group-management.component.html',
  styleUrls: ['./group-management.component.scss']
})
export class GroupManagementComponent implements OnInit {
  groupForm: FormGroup;
  groups$: Observable<Group[]>;
  loading = false;
  selectedGroup: Group | null = null;
  showCreateGroup = false;
  currentRound: number = 1;
  selectedGroupMembers = new BehaviorSubject<GroupMemberDisplay[]>([]);
  showMembersList = false;

  constructor(
    private fb: FormBuilder,
    private groupService: GroupService,
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private footballService: FootballService,
    private databaseService: DatabaseService
  ) {
    this.groupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      isPrivate: [true]
    });
    this.groups$ = this.groupService.getUserGroups();
  }

  async ngOnInit() {
    try {
      this.currentRound = await this.footballService.getCurrentRound();
    } catch (error) {
      console.error('Error getting current round:', error);
      this.currentRound = 1;
    }
  }

  toggleCreateGroup() {
    this.showCreateGroup = !this.showCreateGroup;
    if (!this.showCreateGroup) {
      this.groupForm.reset({
        name: '',
        description: '',
        isPrivate: true
      });
    }
  }

  async createGroup() {
    if (this.groupForm.valid) {
      this.loading = true;
      try {
        await this.groupService.createGroup(this.groupForm.value);
        await this.showToast('Grupo creado exitosamente', 'success');
        this.toggleCreateGroup();
      } catch (error) {
        console.error('Error creating group:', error);
        await this.showToast('Error al crear el grupo', 'danger');
      } finally {
        this.loading = false;
      }
    }
  }

  async joinGroup() {
    const alert = await this.alertController.create({
      header: 'Unirse a un grupo',
      message: 'Ingresa el código de invitación del grupo',
      inputs: [
        {
          name: 'inviteCode',
          type: 'text',
          placeholder: 'Código de invitación'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Unirse',
          handler: async (data) => {
            if (!data.inviteCode) {
              await this.showToast('Por favor ingresa un código de invitación', 'warning');
              return false;
            }

            this.loading = true;
            try {
              await this.groupService.joinGroup(data.inviteCode);
              await this.showToast('Te has unido al grupo exitosamente', 'success');
              return true;
            } catch (error) {
              console.error('Error joining group:', error);
              await this.showToast('Error al unirse al grupo', 'danger');
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

  async showInviteCode(group: Group) {
    const alert = await this.alertController.create({
      header: 'Código de invitación',
      message: `
        <div class="invite-code">
          <p>Comparte este código con otros usuarios para que se unan al grupo:</p>
          <div class="code">${group.inviteCode}</div>
        </div>
      `,
      buttons: ['OK']
    });
    await alert.present();
  }

  async toggleMembersList(group: Group) {
    if (!group.id) return;
    
    if (this.selectedGroup?.id === group.id && this.showMembersList) {
      // If clicking the same group, just toggle visibility
      this.showMembersList = false;
      this.selectedGroup = null;
      this.selectedGroupMembers.next([]);
      return;
    }

    this.loading = true;
    this.selectedGroup = group;
    this.showMembersList = true;
    
    try {
      const members = await firstValueFrom(this.groupService.getGroupMembers(group.id));
      
      if (!members || members.length === 0) {
        await this.showToast('No hay miembros en este grupo', 'warning');
        return;
      }

      const membersWithPredictions: GroupMemberDisplay[] = await Promise.all(
        members.map(async member => {
          const predictions = await firstValueFrom(
            this.databaseService.getPredictions(member.uid, this.currentRound.toString())
          );
          return {
            ...member,
            hasPredicted: predictions.length > 0
          };
        })
      );

      // Sort members: first by prediction status (not predicted first), then by role (admins first)
      const sortedMembers = membersWithPredictions.sort((a, b) => {
        if (a.hasPredicted === b.hasPredicted) {
          return b.role === 'admin' ? 1 : -1;
        }
        return a.hasPredicted ? 1 : -1;
      });

      this.selectedGroupMembers.next(sortedMembers);
    } catch (error) {
      await this.showToast('Error al cargar los miembros del grupo', 'danger');
      this.showMembersList = false;
      this.selectedGroup = null;
    } finally {
      this.loading = false;
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}