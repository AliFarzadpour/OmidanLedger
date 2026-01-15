import 'server-only';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY in environment (App Hosting env var not set).");
}

export const ai = genkit({
  plugins: [googleAI({apiKey})],
  model: 'googleai/gemini-2.5-flash',
});
