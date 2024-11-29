export interface User {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  isAdmin?: boolean;
}
