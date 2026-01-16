import 'server-only';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// The API key is read from the environment at runtime.
// The build server does not need to have this key, and the check was causing the build to fail.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // This warning will show in the runtime logs if the key is missing,
  // but it won't crash the build process.
  console.warn("GEMINI_API_KEY is not set. AI features will fail at runtime.");
}

export const ai = genkit({
  plugins: [googleAI({apiKey})],
  model: 'googleai/gemini-2.5-flash',
});
