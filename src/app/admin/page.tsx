'use server';

import { db } from '@/lib/admin-db';
import { doc, getDoc } from 'firebase/firestore';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export default async function SuperAdminPage() {
  let initialStats = {};
  try {
    const statsDoc = await getDoc(doc(db, 'system/global_stats'));
    if (statsDoc.exists()) {
      const data = statsDoc.data();
      // Firestore timestamps need to be converted for client components
      initialStats = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === 'object' && value.hasOwnProperty('seconds')) {
          return new Date(value.seconds * 1000).toISOString();
        }
        return value;
      }));
    }
  } catch (error) {
    console.error("Failed to fetch initial stats on server:", error);
  }

  return <AdminDashboard initialStats={initialStats} />;
}
