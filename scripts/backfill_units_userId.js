/**
 * Backfill userId on properties/{propertyId}/units/{unitId}
 * Uses the property doc's userId as the source of truth.
 *
 * Run: node scripts/backfill_units_userId.js
 */

const admin = require("firebase-admin");

function initAdmin() {
  // Prefer FIREBASE_SERVICE_ACCOUNT_KEY JSON string if you have it
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in env");

  const serviceAccount = JSON.parse(raw);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

async function main() {
  const db = initAdmin();

  const propsSnap = await db.collection("properties").get();
  console.log("Properties found:", propsSnap.size);

  let updated = 0;
  let scanned = 0;

  for (const propDoc of propsSnap.docs) {
    const propertyId = propDoc.id;
    const prop = propDoc.data();
    const ownerId = prop.userId;

    if (!ownerId) {
      console.log(`SKIP property ${propertyId} (missing userId)`);
      continue;
    }

    const unitsSnap = await db.collection("properties").doc(propertyId).collection("units").get();

    for (const unitDoc of unitsSnap.docs) {
      scanned++;
      const u = unitDoc.data();

      const needsUserId = !u.userId;
      const needsPropertyId = u.propertyId !== propertyId;

      if (!needsUserId && !needsPropertyId) continue;

      const patch = {};
      if (needsUserId) patch.userId = ownerId;
      if (needsPropertyId) patch.propertyId = propertyId;

      await unitDoc.ref.set(patch, { merge: true });
      updated++;
      console.log("Patched unit:", `properties/${propertyId}/units/${unitDoc.id}`, patch);
    }
  }

  console.log("Done. Scanned:", scanned, "Updated:", updated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
