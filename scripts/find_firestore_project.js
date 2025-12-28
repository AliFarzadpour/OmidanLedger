
const admin = require("firebase-admin");

const PROJECT_IDS = [
  "ai-auditor-backup-1-2747-c06a4",
  "ai-auditor-backup-2-4576-701cd",
  "studio-1018264910-74873",
  "studio-3689680299-38569",
  "studio-4266990176-8d573",
  "studio-4663861936-92406",
  "studio-4857149536-b70d3",
  "studio-5528524935-9ecbb",
  "studio-5636157660-3b6c9",
  "studio-6403112669-e08b2",
  "studio-7366801136-ae9b7",
  "studio-7576922301-bac28",
  "studio-811444605-7ef2a",
  "studio-8131335974-b22de",
  "studio-9473593416-65a29",
];

async function check(projectId) {
  const app = admin.initializeApp(
    {
      credential: admin.credential.applicationDefault(),
      projectId,
    },
    projectId
  );

  const db = app.firestore();
  try {
    // Check for your root 'users' collection
    const snap = await db.collection("users").limit(1).get();
    const hasUsers = !snap.empty;

    // If users exist, check whether the expected subcollection path likely exists
    // by peeking at one user's bankAccounts.
    let bankAccountsCount = 0;
    if (hasUsers) {
      const userDocId = snap.docs[0].id;
      const baSnap = await db
        .collection("users")
        .doc(userDocId)
        .collection("bankAccounts")
        .limit(1)
        .get();
      bankAccountsCount = baSnap.size;
    }

    console.log(
      JSON.stringify(
        {
          projectId,
          usersDocFound: hasUsers,
          sampleUserHasBankAccounts: bankAccountsCount > 0,
        },
        null,
        0
      )
    );
  } catch (e) {
    console.log(
      JSON.stringify(
        {
          projectId,
          error: e?.message || String(e),
        },
        null,
        0
      )
    );
  } finally {
    await app.delete();
  }
}

(async () => {
  for (const pid of PROJECT_IDS) {
    await check(pid);
  }
})();
