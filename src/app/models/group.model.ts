import firebase from 'firebase/compat/app';

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
  code?: string;
}
