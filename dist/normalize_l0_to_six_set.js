"use strict";
const admin = require("firebase-admin");
const fs = require('fs');
const path = require('path');
let projectId;
try {
    const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        projectId = serviceAccount.project_id;
    }
}
catch (e) {
    // fallback to env var if service account is missing or malformed
    projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
}
if (!projectId) {
    throw new Error("Could not determine project ID. Ensure service-account.json exists or GOOGLE_CLOUD_PROJECT is set.");
}
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
});
const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === "true";
const PAGE_SIZE = 400;
const BATCH_SIZE = 450;
const ALLOWED_L0 = new Set([
    "INCOME",
    "OPERATING EXPENSE",
    "EXPENSE",
    "ASSET",
    "LIABILITY",
    "EQUITY",
]);
function mapL0(oldL0, amount) {
    if (!oldL0)
        return amount < 0 ? "OPERATING EXPENSE" : "INCOME";
    const up = String(oldL0).trim().toUpperCase();
    if (ALLOWED_L0.has(up))
        return up;
    const v = String(oldL0).trim().toLowerCase();
    if (v === "income")
        return "INCOME";
    if (v === "expense" || v === "expenses")
        return "OPERATING EXPENSE";
    if (v.includes("operating"))
        return "OPERATING EXPENSE";
    if (v.includes("income"))
        return "INCOME";
    if (v.includes("asset"))
        return "ASSET";
    if (v.includes("liability"))
        return "LIABILITY";
    if (v.includes("equity"))
        return "EQUITY";
    return amount < 0 ? "OPERATING EXPENSE" : "INCOME";
}
async function migrateUser(userId) {
    const bankAccountsRef = db.collection("users").doc(userId).collection("bankAccounts");
    const bankAccountsSnap = await bankAccountsRef.get();
    const bankAccounts = bankAccountsSnap.docs.map((d) => d.id);
    const stats = {
        userId,
        bankAccounts: bankAccounts.length,
        scanned: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
    };
    for (const acctId of bankAccounts) {
        const txRef = bankAccountsRef.doc(acctId).collection("transactions");
        let lastDoc = null;
        while (true) {
            let q = txRef.orderBy("date").limit(PAGE_SIZE);
            if (lastDoc)
                q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty)
                break;
            const docs = snap.docs;
            lastDoc = docs[docs.length - 1];
            let batch = db.batch();
            let ops = 0;
            for (const doc of docs) {
                stats.scanned++;
                const tx = doc.data() || {};
                const ch = tx.categoryHierarchy || {};
                const amount = Number(tx.amount || 0);
                const newL0 = mapL0(ch.l0, amount);
                const oldL0 = ch.l0;
                if (oldL0 === newL0) {
                    stats.skipped++;
                    continue;
                }
                stats.updated++;
                if (!DRY_RUN) {
                    batch.update(doc.ref, {
                        categoryHierarchy: { ...ch, l0: newL0 },
                        l0NormalizedToSixSet: true,
                    });
                }
                ops++;
                if (ops >= BATCH_SIZE) {
                    if (!DRY_RUN)
                        await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
            if (ops > 0) {
                if (!DRY_RUN)
                    await batch.commit();
            }
        }
    }
    return stats;
}
async function main() {
    console.log("=== Normalize L0 to 6-set ===");
    console.log("Using projectId:", projectId);
    console.log("DRY_RUN:", DRY_RUN);
    const usersSnap = await db.collection("users").get();
    console.log("Users found:", usersSnap.size);
    for (const u of usersSnap.docs) {
        try {
            const s = await migrateUser(u.id);
            console.log("User stats:", s);
        }
        catch (e) {
            console.error("User error:", u.id, e?.message || e);
        }
    }
    console.log("=== Done ===");
}
main().catch((e) => {
    console.error("Fatal:", e?.message || e);
    process.exit(1);
});
