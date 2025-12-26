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
  bankAccountId?: string; // This is crucial for updating the doc
  reviewStatus?: 'needs-review' | 'approved' | 'incorrect';
  auditStatus?: 'needs_audit' | 'audited'; // NEW, SEPARATE FIELD
}

export interface AuditIssue {
  type: 'mismatch' | 'uncategorized' | 'missing_hierarchy' | 'duplicate' | 'transfer_error' | 'credit_card_payment';
  message: string;
  transaction: Transaction;
}
