
'use server';

import 'dotenv/config';
import '@/ai/flows/categorize-transactions.ts';
import '@/ai/flows/categorize-transactions-from-statement.ts';
import '@/ai/flows/category-framework.ts';
import '@/ai/flows/learn-category-mapping.ts';
import '@/ai/flows/generalize-transaction-description.ts';
import '@/lib/plaid.ts';
import '@/ai/flows/generate-financial-report.ts';
import '@/ai/flows/identify-contacts.ts';
import '@/ai/flows/analyze-transaction-entity.ts';
import '@/ai/flows/deep-categorize-transaction.ts';
import '@/ai/flows/publish-user-rules.ts';
import '@/ai/flows/repair-transactions.ts';
import '@/ai/flows/lease-flow.ts'; 
// import '@/ai/flows/schemas/lease-flow.schema.ts'; // This is no longer needed
