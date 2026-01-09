// logic temporarily disabled to break infinite loop
// but keeping exports to satisfy build requirements

export async function syncTransactions() {
  console.log('Sync is currently disabled');
  return { added: [], modified: [], removed: [] };
}

export async function createBankAccountFromPlaid() {
  console.log('Bank account creation disabled');
  return { success: false };
}

export async function exchangePublicToken() {
  return { success: false };
}

export async function createLinkToken() {
  return { link_token: '' };
}
