import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { GroupService } from './group.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

export interface InvitationInfo {
  code: string;
  groupName: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private invitationInfo = new BehaviorSubject<InvitationInfo | null>(null);

  constructor(
    private groupService: GroupService,
    private afs: AngularFirestore
  ) {}

  async validateInviteCode(code: string): Promise<boolean> {
    try {
      const group = await firstValueFrom(this.groupService.getGroupByInviteCode(code));
      if (group) {
        this.invitationInfo.next({
          code,
          groupName: group.name
        });
        return true;
      }
      this.invitationInfo.next(null);
      return false;
    } catch (error) {
      console.error('Error validating invite code:', error);
      this.invitationInfo.next(null);
      return false;
    }
  }

  async sendInvitation(groupId: string, inviteCode: string, email: string): Promise<void> {
    try {
      const groupData = await firstValueFrom(this.groupService.getGroupByInviteCode(inviteCode));
      if (!groupData) {
        throw new Error('Grupo no encontrado');
      }

      const inviteLink = this.groupService.generateInviteLink(groupId, inviteCode);
      const invitation = {
        groupId,
        groupName: groupData.name,
        inviteCode,
        inviteLink,
        email,
        sentAt: firebase.firestore.Timestamp.now()
      };

      await this.afs.collection('invitations').add(invitation);
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw new Error('Error al enviar la invitación');
    }
  }

  setInvitationInfo(code: string | null) {
    if (!code) {
      this.invitationInfo.next(null);
      return;
    }

    this.validateInviteCode(code).catch(error => {
      console.error('Error setting invitation info:', error);
      this.invitationInfo.next(null);
    });
  }

  getInvitationInfo(): Observable<InvitationInfo | null> {
    return this.invitationInfo.asObservable();
  }

  clearInvitationInfo(): void {
    this.invitationInfo.next(null);
  }
}