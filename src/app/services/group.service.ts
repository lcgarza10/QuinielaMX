import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of, from, throwError, firstValueFrom, combineLatest } from 'rxjs';
import { map, catchError, tap, switchMap, take } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import { AuthService, User } from './auth.service';
import { Router } from '@angular/router';

export interface Group {
  id?: string;
  name: string;
  description: string;
  createdAt: firebase.firestore.Timestamp;
  createdBy: string;
  inviteCode: string;
  isPrivate: boolean;
  memberCount: number;
  members: string[];
  admins: string[];
}

export interface GroupMember {
  userId: string;
  joinedAt: firebase.firestore.Timestamp;
  role: 'member' | 'admin';
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private readonly APP_DOMAIN = 'https://quinielamx.netlify.app';
  private groupCache: { [key: string]: Group } = {};

  constructor(
    private afs: AngularFirestore,
    private authService: AuthService,
    private router: Router
  ) {}

  async createGroup(groupData: Partial<Group>): Promise<string> {
    const user = await firstValueFrom(this.authService.user$.pipe(take(1)));
    if (!user) throw new Error('Usuario no autenticado');

    const inviteCode = this.generateInviteCode();
    const group: Omit<Group, 'id'> = {
      name: groupData.name!,
      description: groupData.description || '',
      createdAt: firebase.firestore.Timestamp.now(),
      createdBy: user.uid,
      inviteCode,
      isPrivate: groupData.isPrivate || false,
      memberCount: 1,
      members: [user.uid],
      admins: [user.uid]
    };

    const docRef = await this.afs.collection('groups').add(group);
    return docRef.id;
  }

  getUserGroups(): Observable<Group[]> {
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        // Force a server fetch by using { source: 'server' }
        return this.afs.collection<Group>('groups', ref => 
          ref.where('members', 'array-contains', user.uid)
        ).valueChanges({ idField: 'id' }).pipe(
          tap(groups => {
            // Update cache with fresh data
            groups.forEach(group => {
              if (group.id) {
                this.groupCache[group.id] = group;
              }
            });
          }),
          // Ensure we have fresh data
          take(1)
        );
      })
    );
  }

  async clearGroupCache() {
    this.groupCache = {};
    // Force a new fetch from server
    await firstValueFrom(this.getUserGroups());
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getGroupByInviteCode(code: string): Observable<Group | null> {
    return this.afs.collection<Group>('groups', ref => 
      ref.where('inviteCode', '==', code).limit(1)
    ).valueChanges({ idField: 'id' }).pipe(
      map(groups => groups[0] || null)
    );
  }

  async joinGroup(groupId: string): Promise<void> {
    const user = await firstValueFrom(this.authService.user$.pipe(take(1)));
    if (!user) throw new Error('Usuario no autenticado');

    await this.afs.doc(`groups/${groupId}`).update({
      members: firebase.firestore.FieldValue.arrayUnion(user.uid),
      memberCount: firebase.firestore.FieldValue.increment(1)
    });
  }

  getGroupMembers(groupId: string): Observable<(User & { role: string })[]> {
    return this.afs.doc<Group>(`groups/${groupId}`).valueChanges().pipe(
      switchMap(group => {
        if (!group?.members?.length) return of([]);
        return combineLatest(
          group.members.map(uid => 
            this.afs.doc<User>(`users/${uid}`).valueChanges().pipe(
              map(user => {
                if (!user) return undefined;
                return {
                  ...user,
                  role: group.admins.includes(uid) ? 'admin' : 'member'
                };
              })
            )
          )
        ).pipe(
          map(users => users.filter((u): u is User & { role: string } => u !== undefined))
        );
      })
    );
  }

  async updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
    await this.afs.doc(`groups/${groupId}`).update(data);
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.afs.doc(`groups/${groupId}`).delete();
  }

  generateInviteLink(groupId: string, inviteCode: string): string {
    return `${this.APP_DOMAIN}/groups/join/${inviteCode}`;
  }
}