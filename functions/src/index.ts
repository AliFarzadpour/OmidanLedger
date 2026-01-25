// USE MODERN GEN 2 IMPORTS
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Initialize Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// 1. Setup Plaid Client
const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "YOUR_CLIENT_ID_HERE",
      "PLAID-SECRET": process.env.PLAID_SECRET || "YOUR_SECRET_HERE",
    },
  },
});
const plaidClient = new PlaidApi(configuration);

// 2. The Repair Function (Gen 2 + Repair Bot)
export const updateTokens = onRequest(
  { 
    timeoutSeconds: 300,
    memory: "256MiB",
    serviceAccount: "repair-bot@studio-7576922301-bac28.iam.gserviceaccount.com", // Uses your "Editor" bot
    cors: true // Allows browser access
  }, 
  async (req: any, res: any) => {
    const WEBHOOK_URL = "https://omidanledger.com/api/webhooks/plaid"; 
    const processedTokens = new Set<string>();
    let successCount = 0;
    let errorCount = 0;

    try {
      console.log("Starting Webhook Repair (Gen 2)...");
      const snapshot = await db.collectionGroup("bankAccounts").get();
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const token = data.plaidAccessToken;

        if (!token || processedTokens.has(token)) continue;
        processedTokens.add(token);

        try {
          await plaidClient.itemWebhookUpdate({
            access_token: token,
            webhook: WEBHOOK_URL,
          });
          console.log(`Success: ...${token.slice(-4)}`);
          successCount++;
        } catch (err: any) {
          console.error(`Error: ...${token.slice(-4)}`, err?.message);
          errorCount++;
        }
      }

      res.json({ status: "Success", updated: successCount, failures: errorCount });

    } catch (error) {
      console.error("Critical error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);