import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GroupService, Group } from '../../services/group.service';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Observable, firstValueFrom, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { User } from '../../services/auth.service';
import { FootballService } from '../../services/football.service';
import { DatabaseService } from '../../services/database.service';

interface GroupWithMembers extends Group {
  membersList: GroupMemberDisplay[];
}

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
  groups$: Observable<GroupWithMembers[]>;
  loading = false;
  showCreateGroup = false;
  currentRound: number = 1;

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

    // Initialize groups$ with members data
    this.groups$ = this.groupService.getUserGroups().pipe(
      switchMap(groups => {
        const groupsWithMembers$ = groups.map(group => 
          this.loadGroupMembers(group).then(members => ({
            ...group,
            membersList: members,
            memberCount: members.length // Update member count based on actual members
          }))
        );
        return Promise.all(groupsWithMembers$);
      })
    );
  }

  async ngOnInit() {
    try {
      this.currentRound = await this.footballService.getCurrentRound();
    } catch (error) {
      console.error('Error getting current round:', error);
      this.currentRound = 1;
    }
  }

  private async loadGroupMembers(group: Group): Promise<GroupMemberDisplay[]> {
    if (!group.id) return [];

    try {
      const members = await firstValueFrom(this.groupService.getGroupMembers(group.id));
      
      const membersWithPredictions = await Promise.all(
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
      return membersWithPredictions.sort((a, b) => {
        if (a.hasPredicted === b.hasPredicted) {
          return b.role === 'admin' ? 1 : -1;
        }
        return a.hasPredicted ? 1 : -1;
      });
    } catch (error) {
      console.error('Error loading group members:', error);
      return [];
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
      message: 'Cargando...',
      buttons: [
        {
          text: 'Copiar',
          handler: () => {
            navigator.clipboard.writeText(group.inviteCode)
              .then(() => {
                this.showToast('Código copiado al portapapeles', 'success');
              })
              .catch(err => {
                console.error('Error copying to clipboard:', err);
                this.showToast('Error al copiar el código', 'danger');
              });
            return false; // Keep the alert open
          }
        },
        {
          text: 'Cerrar',
          role: 'cancel'
        }
      ],
      cssClass: 'invite-code-alert'
    });

    await alert.present();

    // Update alert message with styled content
    const messageEl = document.querySelector('.alert-message');
    if (messageEl) {
      messageEl.innerHTML = `
        <div class="invite-code">
          <p>Comparte este código con otros usuarios para que se unan al grupo:</p>
          <div class="code-container">
            <div class="code">${group.inviteCode}</div>
          </div>
        </div>
      `;
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