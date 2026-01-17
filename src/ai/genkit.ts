import 'server-only';
import {genkit, type GenkitPlugin} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const apiKey = process.env.GEMINI_API_KEY;

const plugins: GenkitPlugin[] = [];

if (apiKey) {
  plugins.push(googleAI({apiKey}));
} else {
  // This warning will show in the runtime logs if the key is missing,
  // but it won't crash the build process.
  console.warn("GEMINI_API_KEY is not set. AI features will be disabled at runtime.");
}

export const ai = genkit({
  plugins: plugins,
  model: 'googleai/gemini-2.5-flash',
});
