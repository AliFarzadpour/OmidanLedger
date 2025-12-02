import { config } from 'dotenv';
config();

import '@/ai/flows/categorize-transactions.ts';
import '@/ai/flows/categorize-transactions-from-statement.ts';
import '@/ai/flows/category-framework.ts';
