import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GroupService, Group } from '../../services/group.service';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Observable, firstValueFrom, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { User } from '../../services/auth.service';
import { FootballService } from '../../services/football.service';
import { DatabaseService } from '../../services/database.service';
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
          this.loadGroupMembers(group).then(members => ({
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
        const alert = await this.alertController.create({
          header: 'Unirse al Grupo',
          message: `¿Deseas unirte al grupo "${group.name}"?`,
          buttons: [
            {
              text: 'Cancelar',
              role: 'cancel'
            },
            {
              text: 'Unirme',
              handler: async () => {
                await this.joinGroupWithCode(inviteCode);
              }
            }
          ]
        });
        await alert.present();
      }
    } catch (error) {
      console.error('Error handling invite code:', error);
    }
  }

  private async loadGroupMembers(group: Group): Promise<GroupMemberDisplay[]> {
    if (!group.id) return [];

    try {
      const members = await firstValueFrom(this.groupService.getGroupMembers(group.id));
      
      // Load predictions for all members in parallel
      const membersWithPredictions = await Promise.all(
        members.map(async member => {
          try {
            const predictions = await firstValueFrom(
              this.databaseService.getPredictions(member.uid, this.currentRound.toString())
            );

            // Check if member has valid predictions for current round
            const hasPredicted = predictions.length > 0 && predictions.every(pred => 
              pred.matchId && 
              pred.homeScore !== null && 
              pred.awayScore !== null
            );

            return {
              ...member,
              hasPredicted
            };
          } catch (error) {
            console.error(`Error loading predictions for member ${member.uid}:`, error);
            return {
              ...member,
              hasPredicted: false
            };
          }
        })
      );

      // Sort members: admins first, then by prediction status
      return membersWithPredictions.sort((a, b) => {
        if (a.role === b.role) {
          // If roles are the same, sort by prediction status (pending first)
          return (a.hasPredicted ? 1 : 0) - (b.hasPredicted ? 1 : 0);
        }
        // Sort by role (admins first)
        return a.role === 'admin' ? -1 : 1;
      });

    } catch (error) {
      console.error('Error loading group members:', error);
      await this.showToast('Error loading group members', 'danger');
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
            await this.joinGroupWithCode(data.inviteCode);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async joinGroupWithCode(inviteCode: string) {
    this.loading = true;
    try {
      await this.groupService.joinGroup(inviteCode);
      await this.showToast('Successfully joined the group', 'success');
    } catch (error) {
      console.error('Error joining group:', error);
      await this.showToast('Error joining group', 'danger');
    } finally {
      this.loading = false;
    }
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