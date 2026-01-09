// logic temporarily disabled to break infinite loop
// keeping exports to satisfy build requirements (UI and AI flows)

export async function syncTransactions() {
  return { added: [], modified: [], removed: [] };
}

export async function syncAndCategorizePlaidTransactions() {
  return { success: true, message: 'Sync disabled' };
}

export async function createBankAccountFromPlaid() {
  return { success: false };
}

export async function exchangePublicToken() {
  return { success: false };
}

export async function createLinkToken() {
  return { link_token: '' };
}

// AI Flow Exports
export async function categorizeWithHeuristics() {
  return null;
}

export async function fetchUserContext() {
  return null;
}

export async function getCategoryFromDatabase() {
  return null;
}
