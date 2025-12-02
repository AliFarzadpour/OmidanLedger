'use server';
/**
 * @fileOverview AI flows for interacting with the Plaid API.
 * - createLinkToken: Creates a link_token required to initialize Plaid Link.
 * - exchangePublicToken: Exchanges a public_token for an access_token.
 * - createBankAccountFromPlaid: Creates a bank account record in Firestore from Plaid data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { PlaidApi, Configuration, PlaidEnvironments, TransactionsSyncRequest, RemovedTransaction } from 'plaid';
import { initializeFirebase, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';

const PlaidConfigSchema = z.object({
  clientId: z.string(),
  secret: z.string(),
  env: z.string().default('sandbox'),
});

function getPlaidClient() {
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env;

  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    console.error('Plaid client ID or secret not set in environment variables.');
    throw new Error('Plaid integration is not configured. Please add PLAID_CLIENT_ID and PLAID_SECRET to your environment variables.');
  }

  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });

  return new PlaidApi(plaidConfig);
}

const CreateLinkTokenInputSchema = z.object({
  userId: z.string().describe('The unique identifier for the user.'),
});

export async function createLinkToken(input: z.infer<typeof CreateLinkTokenInputSchema>): Promise<string> {
  return createLinkTokenFlow(input);
}

const createLinkTokenFlow = ai.defineFlow(
  {
    name: 'createLinkTokenFlow',
    inputSchema: CreateLinkTokenInputSchema,
    outputSchema: z.string(),
  },
  async ({ userId }) => {
    const plaidClient = getPlaidClient();
    try {
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: userId,
        },
        client_name: 'FiscalFlow',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
        transactions: {
            days_requested: 730,
        }
      });
      return response.data.link_token;
    } catch (error: any) {
      console.error("Error creating Plaid link token:", error.response?.data || error.message);
      throw new Error('Could not create Plaid link token.');
    }
  }
);


const ExchangePublicTokenInputSchema = z.object({
  publicToken: z.string(),
});

export async function exchangePublicToken(input: z.infer<typeof ExchangePublicTokenInputSchema>): Promise<{ accessToken: string; itemId: string; }> {
    return exchangePublicTokenFlow(input);
}

const exchangePublicTokenFlow = ai.defineFlow(
    {
        name: 'exchangePublicTokenFlow',
        inputSchema: ExchangePublicTokenInputSchema,
        outputSchema: z.object({
            accessToken: z.string(),
            itemId: z.string(),
        }),
    },
    async ({ publicToken }) => {
        const plaidClient = getPlaidClient();
        try {
            const response = await plaidClient.itemPublicTokenExchange({
                public_token: publicToken,
            });
            return {
                accessToken: response.data.access_token,
                itemId: response.data.item_id,
            };
        } catch (error: any) {
            console.error('Error exchanging public token:', error.response?.data || error.message);
            throw new Error('Could not exchange public token.');
        }
    }
);


const CreateBankAccountFromPlaidInputSchema = z.object({
    userId: z.string(),
    accessToken: z.string(),
    metadata: z.any(),
});

export async function createBankAccountFromPlaid(input: z.infer<typeof CreateBankAccountFromPlaidInputSchema>): Promise<void> {
    await createBankAccountFromPlaidFlow(input);
}

const createBankAccountFromPlaidFlow = ai.defineFlow(
    {
        name: 'createBankAccountFromPlaidFlow',
        inputSchema: CreateBankAccountFromPlaidInputSchema,
        outputSchema: z.void(),
    },
    async ({ userId, accessToken, metadata }) => {
        const { firestore } = initializeFirebase();
        const plaidClient = getPlaidClient();

        try {
            // Get account details from Plaid
            const accountsResponse = await plaidClient.accountsGet({
                access_token: accessToken,
            });
            const accountData = accountsResponse.data.accounts.find(acc => acc.account_id === metadata.account_id);

            if (!accountData) {
                throw new Error(`Account with ID ${metadata.account_id} not found in Plaid response.`);
            }

            const newAccount = {
                userId,
                plaidAccessToken: accessToken,
                plaidItemId: accountsResponse.data.item.item_id,
                plaidAccountId: accountData.account_id,
                accountName: accountData.name,
                accountType: accountData.subtype || 'other',
                bankName: metadata.institution.name,
                accountNumber: accountData.mask,
            };

            const bankAccountsCol = collection(firestore, `users/${userId}/bankAccounts`);
            // Note: We are not using a blocking call here.
            addDocumentNonBlocking(bankAccountsCol, newAccount);

        } catch (error: any) {
            console.error('Error creating bank account from Plaid:', error.response?.data || error.message);
            throw new Error('Could not create bank account from Plaid data.');
        }
    }
);
