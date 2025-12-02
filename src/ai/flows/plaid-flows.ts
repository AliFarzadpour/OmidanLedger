'use server';
/**
 * @fileOverview AI flows for interacting with the Plaid API.
 * - createLinkToken: Creates a link_token required to initialize Plaid Link.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  throw new Error('Plaid client ID or secret not set in environment variables.');
}

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

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
    try {
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: userId,
        },
        client_name: 'FiscalFlow',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
      });
      return response.data.link_token;
    } catch (error: any) {
      console.error("Error creating Plaid link token:", error.response?.data || error.message);
      throw new Error('Could not create Plaid link token.');
    }
  }
);
