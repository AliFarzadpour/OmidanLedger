'use client';

import { useEffect, useMemo } from 'react';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

export function ChartOfAccountsReport() {
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    if (!user || !firestore) return;

    const debugQuery = async () => {
      console.log("🔍 STARTING DEBUG FETCH...");
      console.log("👤 User ID:", user.uid);

      try {
        // 1. Try a simple fetch without the Hook to isolate issues
        const q = query(
          collectionGroup(firestore, 'transactions'),
          where('userId', '==', user.uid)
        );
        
        const snapshot = await getDocs(q);
        
        console.log(`📊 Found ${snapshot.size} transactions.`);
        
        if (snapshot.empty) {
          console.warn("⚠️ Snapshot is empty. Checking potential reasons:");
          console.warn("1. Do documents inside 'transactions' subcollections actually have a 'userId' field?");
          console.warn("2. Does that 'userId' field match", user.uid, "?");
          console.warn("3. Did you create the Index in Firebase Console? A missing index can cause an empty result.");
        } else {
          snapshot.docs.forEach(doc => {
            console.log("✅ Doc Found:", doc.id, doc.data());
          });
        }
      } catch (err: any) {
        console.error("❌ QUERY ERROR:", err);
        if (err.message.includes('requires an index')) {
          console.error("🚨 YOU NEED TO CREATE AN INDEX! Look for the link above or in the error object.");
        }
      }
    };

    debugQuery();
  }, [user, firestore]);

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
      <h3 className="font-bold">Debug Mode</h3>
      <p>Open your Browser Console (F12) to see why no data is loading. Check the logs for a Firebase index creation link or other errors.</p>
    </div>
  );
}