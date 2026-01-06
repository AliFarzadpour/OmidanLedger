"use strict";
/**
 * One-time Firestore migration:
 * - Backfill userId, bankAccountId
 * - Ensure categoryHierarchy exists (create from legacy fields if needed)
 * - Normalize l0 values to "Income"/"Expense"/"Transfer"/"Other"
 * - Add schemaVersion: 2
 *
 * Run with:
 *   node scripts/migrate_transactions_schema_v2.js
 *
 * Optional:
 *   DRY_RUN=true node scripts/migrate_transactions_schema_v2.js
 */
const admin = require("firebase-admin");
// ---------- CONFIG ----------
const DRY_RUN = process.env.DRY_RUN === "true";
const PAGE_SIZE = 400; // smaller than 500 is safer
const BATCH_SIZE = 450; // Firestore batch limit is 500
const SCHEMA_VERSION = 2;
// IMPORTANT:
// Choose how to treat l2 text:
// "A" = store full leaf text from your CATEGORY_MAP (recommended)
// "B" = keep simplified "Line 14: Repairs" style
const L2_MODE = process.env.L2_MODE || "B"; // set to A or B
// If you have a service account JSON file:
// const serviceAccount = require("./serviceAccountKey.json");
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
// If running in environment where GOOGLE_APPLICATION_CREDENTIALS is set:
admin.initializeApp();
const db = admin.firestore();
function normalizeL0(v) {
    if (!v)
        return "Other";
    const s = String(v).trim().toLowerCase();
    if (s === "income")
        return "Income";
    if (s === "expense" || s === "expenses")
        return "Expense";
    if (s.includes("income"))
        return "Income";
    if (s.includes("expense"))
        return "Expense";
    if (s.includes("transfer"))
        return "Transfer";
    return "Other";
}
// Minimal legacy -> hierarchy conversion (safe default)
function buildHierarchyFromLegacy(tx) {
    const primary = tx.primaryCategory || "";
    const secondary = tx.secondaryCategory || "";
    const subcat = tx.subcategory || "";
    const l0 = normalizeL0(primary);
    // l1: prefer secondary if we can't map deeply
    const l1 = secondary || (l0 === "Income" ? "Income" : l0 === "Expense" ? "Expense" : "Other");
    // l2: prefer subcategory then secondary
    let l2 = subcat || secondary || "Uncategorized";
    // optional: if you want L2_MODE="A", you can later map into CATEGORY_MAP leaf strings.
    // For now we keep safe fallback
    if (L2_MODE === "A") {
        // Placeholder: you’ll later update this block once CATEGORY_MAP is added for exact matching.
        // Keep as-is so migration still works safely today.
        l2 = l2;
    }
    return { l0, l1, l2 };
}
function hasHierarchy(tx) {
    return tx.categoryHierarchy && typeof tx.categoryHierarchy === "object";
}
async function migrateUser(userId) {
    const bankAccountsRef = db.collection("users").doc(userId).collection("bankAccounts");
    const bankAccountsSnap = await bankAccountsRef.get();
    const bankAccounts = bankAccountsSnap.docs.map(d => ({ id: d.id }));
    const stats = {
        userId,
        bankAccounts: bankAccounts.length,
        scanned: 0,
        updated: 0,
        createdHierarchyFromLegacy: 0,
        normalizedHierarchy: 0,
        backfilledUserId: 0,
        backfilledBankAccountId: 0,
        skipped: 0,
        errors: 0,
    };
    for (const acct of bankAccounts) {
        const txRef = bankAccountsRef.doc(acct.id).collection("transactions");
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
            let batchOps = 0;
            for (const doc of docs) {
                stats.scanned++;
                const tx = doc.data() || {};
                const updates = {};
                // backfill userId
                if (!tx.userId || tx.userId !== userId) {
                    updates.userId = userId;
                    stats.backfilledUserId++;
                }
                // backfill bankAccountId
                if (!tx.bankAccountId || tx.bankAccountId !== acct.id) {
                    updates.bankAccountId = acct.id;
                    stats.backfilledBankAccountId++;
                }
                // schema version
                if (tx.schemaVersion !== SCHEMA_VERSION) {
                    updates.schemaVersion = SCHEMA_VERSION;
                }
                // categoryHierarchy normalization / creation
                if (!hasHierarchy(tx)) {
                    const h = buildHierarchyFromLegacy(tx);
                    updates.categoryHierarchy = {
                        l0: h.l0,
                        l1: h.l1,
                        l2: h.l2,
                    };
                    updates.legacyCategory = {
                        primaryCategory: tx.primaryCategory || null,
                        secondaryCategory: tx.secondaryCategory || null,
                        subcategory: tx.subcategory || null,
                    };
                    stats.createdHierarchyFromLegacy++;
                }
                else {
                    const ch = tx.categoryHierarchy || {};
                    const newL0 = normalizeL0(ch.l0);
                    const needsL0 = (ch.l0 !== newL0);
                    // Ensure l1/l2 exist at least
                    const needsL1 = !ch.l1;
                    const needsL2 = !ch.l2;
                    if (needsL0 || needsL1 || needsL2) {
                        updates.categoryHierarchy = {
                            ...ch,
                            l0: newL0,
                            l1: ch.l1 || "Uncategorized",
                            l2: ch.l2 || "Uncategorized",
                        };
                        stats.normalizedHierarchy++;
                    }
                }
                if (Object.keys(updates).length === 0) {
                    stats.skipped++;
                    continue;
                }
                if (!DRY_RUN) {
                    batch.update(doc.ref, updates);
                }
                batchOps++;
                stats.updated++;
                if (batchOps >= BATCH_SIZE) {
                    if (!DRY_RUN)
                        await batch.commit();
                    batch = db.batch();
                    batchOps = 0;
                }
            }
            if (batchOps > 0) {
                if (!DRY_RUN)
                    await batch.commit();
            }
        }
    }
    return stats;
}
async function main() {
    console.log("=== Migration start ===");
    console.log("DRY_RUN:", DRY_RUN);
    console.log("L2_MODE:", L2_MODE);
    const usersSnap = await db.collection("users").get();
    console.log("Users found:", usersSnap.size);
    const allStats = [];
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        try {
            const stats = await migrateUser(userId);
            allStats.push(stats);
            console.log("User stats:", stats);
        }
        catch (e) {
            console.error("User migration error:", userId, e);
        }
    }
    // Summary
    const summary = allStats.reduce((acc, s) => {
        for (const k of Object.keys(s)) {
            if (typeof s[k] === "number")
                acc[k] = (acc[k] || 0) + s[k];
        }
        return acc;
    }, {});
    console.log("=== Migration summary ===");
    console.log(summary);
    console.log("=== Migration done ===");
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
