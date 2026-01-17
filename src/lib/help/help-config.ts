/**
 * Checks if the Help RAG feature is enabled via environment variables.
 * @returns {boolean} True if the feature is enabled, false otherwise.
 */
export function isHelpEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_HELP_RAG === 'true';
}
