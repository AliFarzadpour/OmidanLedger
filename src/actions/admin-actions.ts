
'use server';

import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { isSuperAdmin } from '@/lib/auth-utils';

/**
 * Fetches all users from Firebase Auth and merges their role from Firestore.
 * This is an admin-only action.
 */
export async function getAllUsers(currentUserId: string) {
    if (!await isSuperAdmin(currentUserId)) {
        throw new Error("Permission Denied: You must be an admin to access user data.");
    }

    try {
        const auth = getAdminAuth();
        const db = getAdminDb();
        const listUsersResult = await auth.listUsers(1000);
        const users = listUsersResult.users;

        const userRoles = await Promise.all(users.map(async (user) => {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const role = userDoc.exists ? userDoc.data()?.role : 'user';
            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                role: role,
                disabled: user.disabled,
                lastSignInTime: user.metadata.lastSignInTime,
            };
        }));

        return userRoles;
    } catch (error: any) {
        console.error("Error fetching users:", error);
        throw new Error("Could not fetch user list.");
    }
}

/**
 * Sets the role for a specific user in Firestore.
 * This is an admin-only action.
 */
export async function setUserRole(currentUserId: string, targetUserId: string, role: string) {
     if (!await isSuperAdmin(currentUserId)) {
        throw new Error("Permission Denied: You must be an admin to change roles.");
    }

    try {
        const db = getAdminDb();
        const userRef = db.collection('users').doc(targetUserId);
        await userRef.set({ role: role }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error setting user role:", error);
        throw new Error("Could not update user role.");
    }
}


export async function refreshGlobalSystemStats() {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Could not initialize Firebase Admin Database");
  }

  try {
    const usersSnapshot = await db.collection('users').get();
    const propertiesSnapshot = await db.collection('properties').get();
    
    return {
      success: true,
      stats: {
        userCount: usersSnapshot.size,
        propertyCount: propertiesSnapshot.size
      }
    };
  } catch (err: any) {
    console.error('Stats Refresh Error:', err.message);
    return { success: false, error: err.message };
  }
}
