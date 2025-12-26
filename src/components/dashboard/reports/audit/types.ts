
export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryHierarchy?: {
    l0: string;
    l1: string;
    l2: string;
    l3: string;
  };
  bankAccountId: string;
}

export interface AuditIssue {
  type: 'mismatch' | 'uncategorized' | 'missing_hierarchy';
  message: string;
  transaction: Transaction;
}
