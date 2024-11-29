import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

interface UserData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  createdAt?: firebase.firestore.Timestamp;
  [key: string]: any; // Index signature for dynamic field access
}

interface UpdateData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
  createdAt?: Date;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseCleanupService {
  constructor(private afs: AngularFirestore) {}

  async cleanupUserRecords() {
    try {
      const usersSnapshot = await firstValueFrom(this.afs.collection('users').get());
      let updatedCount = 0;
      const batchSize = 500;
      let currentBatch = this.afs.firestore.batch();
      let operationsInCurrentBatch = 0;

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data() as UserData;
        const updates: UpdateData = {};

        // Only update fields that need to be changed
        if (!userData.email) {
          updates['email'] = '';
        }

        if (!userData.username) {
          updates['username'] = userData.email || '';
        }

        if (!userData.firstName) {
          updates['firstName'] = '';
        }

        if (!userData.lastName) {
          updates['lastName'] = '';
        }

        if (userData.isAdmin === undefined) {
          updates['isAdmin'] = false;
        }

        // Handle createdAt timestamp carefully
        if (!userData.createdAt) {
          updates['createdAt'] = new Date();
        }

        // Fields to remove for security
        const fieldsToRemove = [
          'password',
          'passwordHash',
          'salt',
          'hash',
          'hashedPassword'
        ];

        // Only add field deletions if they exist
        fieldsToRemove.forEach(field => {
          if (userData[field] !== undefined) {
            updates[field] = firebase.firestore.FieldValue.delete();
          }
        });

        // Only update if there are changes to make
        if (Object.keys(updates).length > 0) {
          currentBatch.update(doc.ref, updates);
          updatedCount++;
          operationsInCurrentBatch++;

          // Commit batch when it reaches the size limit
          if (operationsInCurrentBatch === batchSize) {
            await currentBatch.commit();
            currentBatch = this.afs.firestore.batch();
            operationsInCurrentBatch = 0;
          }
        }
      }

      // Commit any remaining operations
      if (operationsInCurrentBatch > 0) {
        await currentBatch.commit();
      }

      console.log(`Successfully standardized ${updatedCount} user records`);
      return updatedCount;
    } catch (error) {
      console.error('Error cleaning up user records:', error);
      throw error;
    }
  }
}