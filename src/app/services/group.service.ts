import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import firebase from 'firebase/compat/app';
import { AuthService, User } from './auth.service';

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
  constructor(
    private afs: AngularFirestore,
    private authService: AuthService
  ) {}

  async createGroup(groupData: Partial<Group>): Promise<string> {
    const user = await this.authService.user$.pipe(take(1)).toPromise();
    if (!user) throw new Error('Usuario no autenticado');

    const inviteCode = this.generateInviteCode();
    const group: Omit<Group, 'id'> = {
      name: groupData.name!,
      description: groupData.description || '',
      createdAt: firebase.firestore.Timestamp.now(),
      createdBy: user.uid,
      inviteCode,
      isPrivate: groupData.isPrivate ?? true,
      memberCount: 1,
      members: [user.uid],
      admins: [user.uid]
    };

    const docRef = await this.afs.collection('groups').add(group);
    
    await this.afs.doc(`groups/${docRef.id}/members/${user.uid}`).set({
      userId: user.uid,
      joinedAt: firebase.firestore.Timestamp.now(),
      role: 'admin'
    });

    await this.afs.doc(`users/${user.uid}/groups/${docRef.id}`).set({
      groupId: docRef.id,
      role: 'admin',
      joinedAt: firebase.firestore.Timestamp.now()
    });

    return docRef.id;
  }

  getUserGroups(): Observable<Group[]> {
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        return this.afs.collection<any>(`users/${user.uid}/groups`).valueChanges()
          .pipe(
            switchMap(userGroups => {
              if (userGroups.length === 0) return of([]);
              const groupIds = userGroups.map(g => g.groupId);
              return combineLatest(
                groupIds.map(id => 
                  this.afs.doc<Group>(`groups/${id}`).valueChanges()
                    .pipe(
                      map(group => {
                        if (!group) return null;
                        return {
                          ...group,
                          id,
                          name: group.name || '',
                          description: group.description || '',
                          members: group.members || [],
                          admins: group.admins || []
                        } as Group;
                      })
                    )
                )
              ).pipe(
                map(groups => groups.filter((g): g is Group => g !== null))
              );
            })
          );
      })
    );
  }

  async joinGroup(inviteCode: string): Promise<void> {
    const user = await this.authService.user$.pipe(take(1)).toPromise();
    if (!user) throw new Error('Usuario no autenticado');

    const groupsRef = this.afs.collection('groups');
    const snapshot = await groupsRef.ref.where('inviteCode', '==', inviteCode).get();

    if (snapshot.empty) {
      throw new Error('Código de invitación inválido');
    }

    const groupDoc = snapshot.docs[0];
    const groupData = groupDoc.data() as Group;

    if (groupData.members.includes(user.uid)) {
      throw new Error('Ya eres miembro de este grupo');
    }

    const batch = this.afs.firestore.batch();

    batch.update(groupDoc.ref, {
      members: firebase.firestore.FieldValue.arrayUnion(user.uid),
      memberCount: firebase.firestore.FieldValue.increment(1)
    });

    const memberRef = this.afs.doc(`groups/${groupDoc.id}/members/${user.uid}`).ref;
    batch.set(memberRef, {
      userId: user.uid,
      joinedAt: firebase.firestore.Timestamp.now(),
      role: 'member'
    });

    const userGroupRef = this.afs.doc(`users/${user.uid}/groups/${groupDoc.id}`).ref;
    batch.set(userGroupRef, {
      groupId: groupDoc.id,
      role: 'member',
      joinedAt: firebase.firestore.Timestamp.now()
    });

    await batch.commit();
  }

  getGroupMembers(groupId: string): Observable<(User & { role: string })[]> {
    return this.afs.collection<GroupMember>(`groups/${groupId}/members`)
      .valueChanges()
      .pipe(
        switchMap(members => {
          const userObservables = members.map(member =>
            this.afs.doc<User>(`users/${member.userId}`).valueChanges()
              .pipe(
                map(user => {
                  if (!user) return null;
                  return {
                    ...user,
                    uid: member.userId,
                    email: user.email || '',
                    role: member.role
                  } as User & { role: string };
                })
              )
          );
          return combineLatest(userObservables).pipe(
            map(users => users.filter((u): u is User & { role: string } => u !== null))
          );
        })
      );
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    const batch = this.afs.firestore.batch();

    batch.update(this.afs.doc(`groups/${groupId}`).ref, {
      members: firebase.firestore.FieldValue.arrayRemove(userId),
      memberCount: firebase.firestore.FieldValue.increment(-1)
    });

    batch.delete(this.afs.doc(`groups/${groupId}/members/${userId}`).ref);
    batch.delete(this.afs.doc(`users/${userId}/groups/${groupId}`).ref);

    await batch.commit();
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getGroupLeaderboard(groupId: string): Observable<any[]> {
    return this.afs.collection<GroupMember>(`groups/${groupId}/members`)
      .valueChanges()
      .pipe(
        switchMap(members => {
          const memberScores = members.map(member =>
            this.afs.doc<User>(`users/${member.userId}`).valueChanges()
              .pipe(
                switchMap(user => 
                  this.afs.doc(`userPoints/${member.userId}`).valueChanges()
                    .pipe(
                      map(points => ({
                        userId: member.userId,
                        username: user?.username || user?.email || 'Usuario',
                        totalPoints: (points as any)?.totalPoints || 0
                      }))
                    )
                )
              )
          );
          return combineLatest(memberScores);
        }),
        map(scores => scores.sort((a, b) => b.totalPoints - a.totalPoints))
      );
  }
}