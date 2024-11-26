import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GroupService } from './group.service';

export interface InvitationInfo {
  code: string;
  groupName: string | null;
  isValid: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private invitationInfo = new BehaviorSubject<InvitationInfo | null>(null);

  constructor(private groupService: GroupService) {}

  async validateInviteCode(code: string): Promise<boolean> {
    try {
      const group = await this.groupService.getGroupByInviteCode(code);
      if (group) {
        this.invitationInfo.next({
          code,
          groupName: group.name,
          isValid: true
        });
        return true;
      }
      this.invitationInfo.next({
        code,
        groupName: null,
        isValid: false
      });
      return false;
    } catch (error) {
      console.error('Error validating invite code:', error);
      this.invitationInfo.next({
        code,
        groupName: null,
        isValid: false
      });
      return false;
    }
  }

  getInvitationInfo(): Observable<InvitationInfo | null> {
    return this.invitationInfo.asObservable();
  }

  clearInvitationInfo(): void {
    this.invitationInfo.next(null);
  }
}