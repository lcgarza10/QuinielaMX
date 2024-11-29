import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { GroupService } from '../../services/group.service';
import { DatabaseService, Prediction } from '../../services/database.service';
import { firstValueFrom } from 'rxjs';
import { Group } from '../../models/group.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FootballService } from '../../services/football.service';
import { User } from '../../services/auth.service';
import { LoadingController } from '@ionic/angular';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

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
  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  constructor(
    private fb: FormBuilder,
    private groupService: GroupService,
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private footballService: FootballService,
    private databaseService: DatabaseService,
    private route: ActivatedRoute
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
          this.loadGroupMembers(group.id!).then(members => ({
            ...group,
            membersList: members,
            memberCount: members.length
          }))
        );
        return Promise.all(groupsWithMembers$);
      })
    );
  }

  async ngOnInit() {
    try {
      this.currentRound = await this.footballService.getCurrentRound();
      
      // Check for invite code in route params
      this.route.queryParams.subscribe(async params => {
        const inviteCode = params['code'];
        if (inviteCode) {
          await this.handleInviteCode(inviteCode);
        }
      });
    } catch (error) {
      console.error('Error getting current round:', error);
      this.currentRound = 1;
    }
  }

  private async handleInviteCode(inviteCode: string) {
    try {
      const group = await this.groupService.getGroupByInviteCode(inviteCode);
      if (group) {
        await this.joinGroupByCode(group);
      }
    } catch (error) {
      console.error('Error handling invite code:', error);
    }
  }

  async joinGroupByCode(group: Observable<Group | null>) {
    const groupData = await firstValueFrom(group);
    if (!groupData) {
      this.showError('Grupo no encontrado');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: `¿Deseas unirte al grupo "${groupData.name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Unirme',
          handler: async () => {
            try {
              await this.groupService.joinGroup(groupData.id!);
              this.showSuccess('Te has unido al grupo exitosamente');
            } catch (error) {
              this.showError('Error al unirte al grupo');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async loadGroupMembers(groupId: string): Promise<GroupMemberDisplay[]> {
    const members = await firstValueFrom(this.groupService.getGroupMembers(groupId));
    const predictionDocs = await firstValueFrom(this.databaseService.getPredictions(groupId, this.currentRound.toString()));
    
    const membersWithPredictions = members.map(member => ({
      ...member,
      hasPredicted: predictionDocs.length > 0
    }));

    return membersWithPredictions.sort((a, b) => {
      if (a.role === b.role) {
        return (a.username || a.email).localeCompare(b.username || b.email);
      }
      return a.role === 'admin' ? -1 : 1;
    });
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
        await this.showToast('Group created successfully', 'success');
        this.toggleCreateGroup();
      } catch (error) {
        console.error('Error creating group:', error);
        await this.showToast('Error creating group', 'danger');
      } finally {
        this.loading = false;
      }
    }
  }

  async joinGroup() {
    const alert = await this.alertController.create({
      header: 'Join a Group',
      message: 'Enter the group invitation code',
      inputs: [
        {
          name: 'inviteCode',
          type: 'text',
          placeholder: 'Invitation code'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Join',
          handler: async (data) => {
            if (!data.inviteCode) {
              await this.showToast('Please enter an invitation code', 'warning');
              return false;
            }
            await this.joinGroupByCode(this.groupService.getGroupByInviteCode(data.inviteCode));
            return true;
          }
        }
      ]
    });
    await alert.present();
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

  private async showError(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }

  private async showSuccess(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  async showInviteCode(group: Group) {
    const inviteLink = this.groupService.generateInviteLink(group.id!, group.inviteCode);
    
    const alert = await this.alertController.create({
      header: 'Invitar al Grupo',
      message: 'Loading...',
      buttons: [
        {
          text: 'Copiar Link',
          handler: () => {
            navigator.clipboard.writeText(inviteLink)
              .then(() => {
                this.showToast('Link copiado al portapapeles', 'success');
              })
              .catch(err => {
                console.error('Error copying to clipboard:', err);
                this.showToast('Error al copiar el link', 'danger');
              });
            return false;
          }
        },
        {
          text: 'Copiar Código',
          handler: () => {
            navigator.clipboard.writeText(group.inviteCode)
              .then(() => {
                this.showToast('Código copiado al portapapeles', 'success');
              })
              .catch(err => {
                console.error('Error copying to clipboard:', err);
                this.showToast('Error al copiar el código', 'danger');
              });
            return false;
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

    const messageEl = document.querySelector('.alert-message');
    if (messageEl) {
      messageEl.innerHTML = `
        <div class="invite-code">
          <p>Comparte este link o código para invitar a otros usuarios:</p>
          <div class="code-container">
            <div class="link">${inviteLink}</div>
            <div class="code">Código: ${group.inviteCode}</div>
          </div>
        </div>
      `;
    }
  }
}